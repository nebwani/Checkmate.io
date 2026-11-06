import type { RawData } from "ws";
import { db } from "@repo/db";
import { TimeControl } from "@prisma/client";
import { getRedis } from "./redis.js";
import { Game } from "./Game.js";
import { SocketManager, type User } from "./SocketManager.js";
import {
    INIT_GAME, MOVE, JOIN_ROOM, GAME_NOT_FOUND, GAME_JOINED,
    RESIGN, OFFER_DRAW, ACCEPT_DRAW, DECLINE_DRAW,
} from "./messages.js";

export class GameManager {
    private games = new Map<string, Game>();
    private pendingGames: Partial<Record<TimeControl, string | undefined>> = {};

    addUser(user: User) {
        user.socket.on("message", async (data) => {
            const message = this.parse(data);
            if (!message) return;                 // not JSON, or no "type": ignore

            try {
                await this.handleMessage(user, message.type, message.payload);
            } catch (err) {
                // One bad message or a DB hiccup must never take the server down
                console.error(`Error handling "${message.type}" from ${user.userId}:`, err);
            }
        });
    }

    removeUser(user: User) {
        SocketManager.getInstance().removeUser(user);
    }

    private parse(data: RawData): { type: string; payload: any } | null {
        try {
            const m = JSON.parse(data.toString());
            return m && typeof m.type === "string"
                ? { type: m.type, payload: m.payload ?? {} }
                : null;
        } catch {
            return null;
        }
    }

    // Register a game and make it unregister itself when it ends
    private track(game: Game) {
        this.games.set(game.gameId, game);
        game.onOver = () => this.games.delete(game.gameId);
    }

    private async handleMessage(user: User, type: string, payload: any) {
        switch (type) {
            case INIT_GAME:    return this.handleInitGame(user, payload.mode);
            case JOIN_ROOM:    return this.handleJoinRoom(user, payload.gameId);
            case MOVE:         return this.games.get(payload.gameId)?.makeMove(user, payload.move);
            case RESIGN:       return this.games.get(payload.gameId)?.resign(user);
            case OFFER_DRAW:   return this.games.get(payload.gameId)?.offerDraw(user);
            case ACCEPT_DRAW:  return this.games.get(payload.gameId)?.acceptDraw(user);
            case DECLINE_DRAW: return this.games.get(payload.gameId)?.declineDraw(user);
        }
    }

    private async handleInitGame(user: User, timeControl: TimeControl) {
        if (!Object.values(TimeControl).includes(timeControl)) return;   // unknown mode

        const pendingId = this.pendingGames[timeControl];
        const waiting = pendingId ? this.games.get(pendingId) : undefined;

        if (waiting) {
            if (waiting.player1UserId === user.userId) return;   // already waiting (other tab)
            // Claim the slot BEFORE awaiting, so two joiners can't get the same game
            this.pendingGames[timeControl] = undefined;
            SocketManager.getInstance().addUser(user, waiting.gameId);
            await waiting.updateSecondPlayer(user.userId);
            return;
        }

        const game = new Game(user.userId, null, timeControl);
        this.track(game);
        this.pendingGames[timeControl] = game.gameId;
        SocketManager.getInstance().addUser(user, game.gameId);
    }

    private async handleJoinRoom(user: User, gameId: unknown) {
        if (typeof gameId !== "string") return;

        const gameFromDb = await db.game.findUnique({
            where: { id: gameId },
            include: {
                moves: { orderBy: { moveNumber: "asc" } },
                blackPlayer: true,
                whitePlayer: true,
            },
        });

        if (!gameFromDb) {
            user.socket.send(JSON.stringify({ type: GAME_NOT_FOUND }));
            return;
        }

        const inProgress = gameFromDb.status === "IN_PROGRESS";

        // Clock snapshot as of lastMoveAt: Redis is live while the game runs,
        // Postgres is the fallback (and the final record once it's over)
        let white = gameFromDb.white_time;
        let black = gameFromDb.black_time;
        let lastMoveAt = Number(gameFromDb.last_move_at);

        if (inProgress) {
            const live = await getRedis().hgetall(`game:${gameId}`);
            if (live?.lastMoveAt) {
                white = Number(live.whiteTime);
                black = Number(live.blackTime);
                lastMoveAt = Number(live.lastMoveAt);
            }
        }

        // Look up AFTER the awaits: another JOIN_ROOM may have restored it meanwhile
        let game = this.games.get(gameId);
        if (!game && inProgress) {
            game = new Game(
                gameFromDb.whitePlayerId,
                gameFromDb.blackPlayerId,
                gameFromDb.timeControl,
                gameId                      // keep the real id (this was the bug)
            );
            this.track(game);               // register before awaiting so a concurrent join reuses it
            try {
                await game.restore(gameFromDb.moves, { white, black, lastMoveAt });
            } catch (err) {
                this.games.delete(gameId);  // don't leave a half-restored game registered
                throw err;                  // logged by the catch in addUser()
            }
        }

        // Clocks as of right now: the side to move has been burning time since lastMoveAt
        const whiteToMove = gameFromDb.moves.length % 2 === 0;
        const elapsed = inProgress ? Date.now() - lastMoveAt : 0;
        const whiteTime = Math.max(0, white - (whiteToMove ? elapsed : 0));
        const blackTime = Math.max(0, black - (whiteToMove ? 0 : elapsed));

        // Keep everything from here to addUser() synchronous: if restore() scheduled an
        // immediate timeout, GAME_JOINED still goes out before GAME_OVER, and this user
        // is already in the room when GAME_OVER is broadcast.
        user.socket.send(JSON.stringify({
            type: GAME_JOINED,
            payload: {
                gameId,
                moves: gameFromDb.moves,
                blackPlayer: {
                    id: gameFromDb.blackPlayer.id,
                    name: gameFromDb.blackPlayer.name,
                    rating: gameFromDb.blackPlayer.rating,
                },
                whitePlayer: {
                    id: gameFromDb.whitePlayer.id,
                    name: gameFromDb.whitePlayer.name,
                    rating: gameFromDb.whitePlayer.rating,
                },
                result: gameFromDb.result,
                whiteTime,
                blackTime,
            },
        }));

        SocketManager.getInstance().addUser(user, gameId);
    }
}