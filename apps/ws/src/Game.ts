import { Chess, type Square, type Move } from "chess.js";
import type WebSocket from "ws";
import { DECLINE_DRAW, GAME_OVER, INIT_GAME, MOVE, OFFER_DRAW } from "./messages.js";
import{db} from "@repo/db"
import { randomUUID } from "crypto"
import { SocketManager, type User } from "./SocketManager.js"
import { calculateElo } from "./elo.js";
import { getRedis } from "./redis.js";
import { TimeControl, type GameResult } from "@prisma/client"

export const TIME_CONTROL_TO_MS: Record<TimeControl, number> = {
  [TimeControl.CLASSICAL]: 10 * 60 * 1000,
  [TimeControl.RAPID]: 5 * 60 * 1000,
  [TimeControl.BLITZ]: 3 * 60 * 1000,
  [TimeControl.BULLET]: 30 * 1000,
};

export function isPromoting(chess: Chess, from: Square, to: Square){
        if(!from){
            return false;
        }
        const piece = chess.get(from);

        if(piece?.type !== "p"){
            return false;
        }

        if(piece.color !== chess.turn()){
            return false;
        }

        if(!["1", "8"].some((it) => to.endsWith(it))){
            return;
        }

        return chess
        .moves({square: from, verbose:true})
        .map((it) => it.to)
        .includes(to);
    }


export class Game{
    public gameId: string;
    public player1UserId: string;
    public player2UserId: string | null;
    public board: Chess
    public moveCount: number; 
    public timeControl: TimeControl;
    private startTime: Date
    private pendingDrawOfferFrom: "w" | "b" | null = null;
    private timer?: NodeJS.Timeout;
    private over = false;
    private moveLock: Promise<void> = Promise.resolve();
    private dbQueue: Promise<void> = Promise.resolve();
    public onOver?: () => void; // the manager uses this to drop finished games from memory

    constructor(player1UserId: string, player2UserId: string | null, timeControl: TimeControl, gameId?: string){
        this.player1UserId = player1UserId;
        this.player2UserId = player2UserId;
        this.timeControl = timeControl;
        this.board = new Chess();
        this.moveCount = 0;
        this.startTime = new Date()
        this.gameId = gameId ?? randomUUID();

    }

    private getPlayerColor(userId: string): "w" | "b" | null {
        if (userId === this.player1UserId) return "w";
        if (userId === this.player2UserId) return "b";
        return null;
    }

    private scheduleTimeout(turn: "w" | "b", msLeft: number) {
        clearTimeout(this.timer);
        this.timer = setTimeout(
            () => this.endGame(turn === "w" ? "BLACK_WINS" : "WHITE_WINS", "TIMEOUT"),
            Math.max(0, msLeft)
        );
    }

    // What the clocks read at the moment the game ended
    private async finalClock(result: GameResult, reason: string) {
        const state = await getRedis().hgetall(`game:${this.gameId}`);
        if (!state?.lastMoveAt) return null;

        let white = Number(state.whiteTime);
        let black = Number(state.blackTime);

        if (reason === "TIMEOUT") {
            // the side that lost on time is at exactly zero
            if (result === "BLACK_WINS") white = 0;
            else black = 0;
        } else if (!this.board.isGameOver()) {
            // resign / agreed draw: the side to move was still burning time
            const elapsed = Date.now() - Number(state.lastMoveAt);
            if (this.board.turn() === "w") white = Math.max(0, white - elapsed);
            else black = Math.max(0, black - elapsed);
        }
        return { white, black };
    }

    private async endGame(result: GameResult, reason: string) {
        if (this.over) return;
        this.over = true;
        clearTimeout(this.timer);
        this.pendingDrawOfferFrom = null;

        try {
            const [white, black] = await Promise.all([
                db.user.findUnique({ where: { id: this.player1UserId } }),
                db.user.findUnique({ where: { id: this.player2UserId! } }),
            ]);
            if (!white || !black) {
                console.error("endGame: player not found for game", this.gameId);
                return;
            }

            const { newWhite, newBlack } = calculateElo(white.rating, black.rating, result);

            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: GAME_OVER,
                payload: { result, reason, whiteRating: newWhite, blackRating: newBlack },
            }));

            const final = await this.finalClock(result, reason).catch(() => null);
            await this.flush();  

            await db.$transaction([
                db.user.update({ where: { id: white.id }, data: { rating: newWhite } }),
                db.user.update({ where: { id: black.id }, data: { rating: newBlack } }),
                db.game.update({
                    where: { id: this.gameId },
                    data: {
                        status: "COMPLETED",
                        result,
                        endAt: new Date(),
                        ...(final ? { white_time: final.white, black_time: final.black } : {}),
                    },
                }),
            ]);
        } catch (err) {
            console.error("endGame failed:", err);
        } finally {
            this.onOver?.();
        }
    }

    async resign(user: User) {
        const color = this.getPlayerColor(user.userId);
        if (!color || !this.player2UserId) return;
        await this.endGame(color === "w" ? "BLACK_WINS" : "WHITE_WINS", "RESIGNATION");
    }

    offerDraw(user: User) {
        const color = this.getPlayerColor(user.userId);
        if (!color) return;

        if (this.pendingDrawOfferFrom) return; // already pending

        this.pendingDrawOfferFrom = color;

        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
            type: OFFER_DRAW,
            payload: { from: color }
        }));
    }

    async acceptDraw(user: User) {
        const color = this.getPlayerColor(user.userId);
        if (!color || this.over) return;
        if (!this.pendingDrawOfferFrom || this.pendingDrawOfferFrom === color) return;
        await this.endGame("DRAW", "AGREED_DRAW");
    }

    declineDraw(user: User) {
        const color = this.getPlayerColor(user.userId);
        if (!color) return;

        if (this.pendingDrawOfferFrom !== color) {
            this.pendingDrawOfferFrom = null;
            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: DECLINE_DRAW
            }));
        }
    }



    async updateSecondPlayer(player2UserId: string) {
        const time = TIME_CONTROL_TO_MS[this.timeControl];
        this.player2UserId = player2UserId;
        if(player2UserId === this.player1UserId){
            return;
        }
        const users = await db.user.findMany({
            where: {
                id: {
                    in: [this.player1UserId, this.player2UserId ?? ""]
                }
            }
        });

        try {
            await this.createGameInDb();
        } catch (error) {
            console.log(error);
            return;
        }

        const redis = getRedis();

        await redis.hset(`game:${this.gameId}`, {
            whiteTime: time,
            blackTime: time,
            lastMoveAt: Date.now(),
            moveCount: 0,
            fen: this.board.fen(),
        });

        this.scheduleTimeout("w", time);    

        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
        type: INIT_GAME,
        payload: {
            gameId: this.gameId,
            whitePlayer: { name: users.find(user => user.id === this.player1UserId)?.name, id: this.player1UserId, rating: users.find(user => user.id === this.player1UserId)?.rating},
            blackPlayer: { name: users.find(user => user.id === this.player2UserId)?.name, id: this.player2UserId, rating: users.find(user => user.id === this.player2UserId)?.rating},
            fen: this.board.fen(),
            moves:[],
            whiteTime: time,
            blackTime: time,
        }
    }))  
    
}

    // Rebuild an in-progress game after a server restart.
    // `clock` is the snapshot as of lastMoveAt (NOT already reduced by elapsed time).
    async restore(
        moves: { moveNumber: number; from: string; to: string; promotion: string | null }[],
        clock: { white: number; black: number; lastMoveAt: number }
    ) {
        // A missing row means a write was lost: say so, instead of a confusing chess.js error
        moves.forEach((m, i) => {
            if (m.moveNumber !== i + 1) {
                throw new Error(`Game ${this.gameId}: move history has a gap at move ${i + 1}`);
            }
        });
        for (const m of moves) {
            this.board.move({
                from: m.from,
                to: m.to,
                ...(m.promotion ? { promotion: m.promotion } : {}),
            });
        }
        this.moveCount = moves.length;

        // makeMove reads the clock from Redis, so make sure it's there
        await getRedis().hset(`game:${this.gameId}`, {
            whiteTime: clock.white,
            blackTime: clock.black,
            lastMoveAt: clock.lastMoveAt,
            moveCount: moves.length,
            fen: this.board.fen(),
        });

        // The side to move has been burning time since lastMoveAt. If that already
        // ran out while the server was down, left <= 0 and the timer fires right away.
        const turn = this.board.turn();
        const left = (turn === "w" ? clock.white : clock.black) - (Date.now() - clock.lastMoveAt);
        this.scheduleTimeout(turn, left);
    }


    async createGameInDb(){
        const now = BigInt(Date.now())
        const time = TIME_CONTROL_TO_MS[this.timeControl];
        console.log({
        timeControl: this.timeControl,
        time,
        });
        const game = await db.game.create({
            data: {
                id: this.gameId,
                timeControl: this.timeControl,
                status: "IN_PROGRESS",
                currentFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                whitePlayer: {
                    connect: {
                        id: this.player1UserId
                    }
                },
                blackPlayer: {
                    connect: {
                        id: this.player2UserId ?? ""
                    }
                },
                white_time: time,
                black_time: time,
                last_move_at: now,
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            }   
        })
        this.gameId = game.id
    }

    // Resolves once every queued write has finished (or been given up on and logged)
    flush() {
        return this.dbQueue;
    }

    private enqueueMoveWrite(w: {
        moveNumber: number;
        move: { from: string; to: string; promotion?: string };
        startFen: string;
        endFen: string;
        timeTaken: number;
        whiteTime: number;
        blackTime: number;
        movedAt: number;
    }) {
        // One id for every attempt: if an attempt actually committed but its reply was lost,
        // the retry hits a duplicate id (P2002) and is treated as done, never a second row
        const id = randomUUID();

        this.dbQueue = this.dbQueue
            .then(async () => {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        await db.$transaction([
                            db.move.create({
                                data: {
                                    id,
                                    gameId: this.gameId,
                                    moveNumber: w.moveNumber,
                                    from: w.move.from,
                                    to: w.move.to,
                                    promotion: w.move.promotion ?? null,
                                    startFen: w.startFen,
                                    endFen: w.endFen,
                                    timeTaken: w.timeTaken,
                                    createdAt: new Date(w.movedAt),
                                },
                            }),
                            db.game.update({
                                where: { id: this.gameId },
                                data: {
                                    currentFen: w.endFen,
                                    white_time: w.whiteTime,
                                    black_time: w.blackTime,
                                    last_move_at: w.movedAt,
                                },
                            }),
                        ]);
                        return;
                    } catch (err) {
                        if ((err as { code?: string }).code === "P2002") return;   // already written
                        console.error(`Game ${this.gameId} move ${w.moveNumber}: DB write failed (attempt ${attempt}/3):`, err);
                        await new Promise(r => setTimeout(r, 200 * attempt));
                    }
                }
                console.error(`GIVING UP on move ${w.moveNumber} of game ${this.gameId}: DB history now has a gap`);
            })
            .catch(err => console.error("DB queue error:", err));   // a bug here must never block later writes
    }

    // Moves for one game run strictly one after another, so each one sees the Redis
    // state (clock, moveCount) written by the one before it
    makeMove(user: User, move: { from: Square; to: Square; promotion?: string }) {
        const run = this.moveLock.then(() => this.applyMove(user, move));
        this.moveLock = run.catch(() => {});   // one failed move must not block the next
        return run;                            // the caller still sees the error
    }

    private async applyMove(user: User, move: { from: Square; to: Square; promotion?: string }) {
        const redis = getRedis();
        const state = await redis.hgetall(`game:${this.gameId}`);

        if (!state || !state.lastMoveAt) {
            console.log("Redis game state missing");
            return;
        }

        // 1. Only a seated player, and only on their own turn
        const color = this.getPlayerColor(user.userId);
        if (this.over || !color || color !== this.board.turn()) return;

        let whiteTime = Number(state.whiteTime);
        let blackTime = Number(state.blackTime);
        const lastMoveAt = Number(state.lastMoveAt);

        // 2. Charge the mover's clock BEFORE touching the board
        const now = Date.now();
        const elapsed = now - lastMoveAt;
        if (color === "w") whiteTime -= elapsed;
        else blackTime -= elapsed;

        // 3. Flag fall: the move is rejected, the board stays untouched
        if ((color === "w" ? whiteTime : blackTime) <= 0) {
            await this.endGame(color === "w" ? "BLACK_WINS" : "WHITE_WINS", "TIMEOUT");
            return;
        }

        // 4. Apply the move
        const startFen = this.board.fen();   // the position BEFORE the move
        let applied: Move;
        try {
            applied = this.board.move({
                from: move.from,
                to: move.to,
                ...(isPromoting(this.board, move.from, move.to)
                    ? { promotion: move.promotion ?? "q" }
                    : {}),
            });
        } catch (error) {
            console.log(error);
            return;
        }

        // What the server actually played, not what the client claimed
        const played = {
            from: applied.from,
            to: applied.to,
            ...(applied.promotion ? { promotion: applied.promotion } : {}),
        };

        // Everything the move changes in memory happens here, before any await
        const endFen = this.board.fen();
        const moveNumber = Number(state.moveCount) + 1;
        this.moveCount = moveNumber;
        this.pendingDrawOfferFrom = null;

        await redis.hset(`game:${this.gameId}`, {
            whiteTime,
            blackTime,
            lastMoveAt: now,
            moveCount: moveNumber,
            fen: endFen,
        });

        this.enqueueMoveWrite({
            moveNumber,
            move: played,
            startFen,
            endFen,
            timeTaken: elapsed,
            whiteTime,
            blackTime,
            movedAt: now,
        });

        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
            type: MOVE,
            payload: { move: played, moveNumber, whiteTime, blackTime },
        }));

        if (this.board.isGameOver()) {
            await this.endGame(
                this.board.isCheckmate() ? (color === "w" ? "WHITE_WINS" : "BLACK_WINS") : "DRAW",
                this.board.isCheckmate() ? "CHECKMATE" : "DRAW"
            );
            return;
        }

        // the opponent's clock starts now
        const next = this.board.turn();
        this.scheduleTimeout(next, next === "w" ? whiteTime : blackTime);
    }
}
    