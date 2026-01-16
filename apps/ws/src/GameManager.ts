import { WebSocket } from "ws";
import { INIT_GAME, JOIN_GAME, MOVE, OPPONENT_DISCONNECTED, JOIN_ROOM, GAME_NOT_FOUND, GAME_JOINED } from "./messages.js";
import { Game, isPromoting } from "./Game.js";
// import { Move } from "chess.js";

import { db } from "@repo/db";
import { SocketManager, User } from "./socketManager.js";
import type { Square } from "chess.js";


export class GameManager{
    private games: Game[];
    private pendingGameId: string  | null;
    private users: User[];
    
    constructor(){
        this.games = []
        this.pendingGameId = null;
        this.users = []
    }
    addUser(user: User){
        this.users.push(user);
        this.addHandler(user);
    }

    removeUser(socket: WebSocket, userId: string){
        const user = this.users.find(user => user.id === userId);
        if(!user){
            console.log("User Not Found");
            return;
        }
        this.users = this.users.filter(user => user.id !== userId);
        SocketManager.getInstance().removeUser(user)
    }

    private addHandler(user: User){
        user.socket.on('message', async(data) => {
            // not using grpc in order to keep it clean
            const message = JSON.parse(data.toString());
            if(message.type === INIT_GAME){
                if(this.pendingGameId){
                    //start a game
                    const game = this.games.find(x => x.gameId === this.pendingGameId);
                    if(!game){
                        console.log("Pending Game not found");
                        return;                    
                    }
                    SocketManager.getInstance().addUser(user, game.gameId);
                    await game?.updateSecondPlayer(user.userId);            
                    this.pendingGameId = null;
                }
                else {
                    const game = new Game(user.userId, null);
                    this.games.push(game);
                    this.pendingGameId = game.gameId;
                    SocketManager.getInstance().addUser(user, game.gameId);
                }
            }

            if(message.type === MOVE){
                const gameId = message.payload.gameId;
                const game = this.games.find(game => game.gameId === gameId);
                if(game){
                    game.makeMove(user, message.payload.move)
                }
            }


            if(message.type === JOIN_ROOM){
                const gameId = message.payload?.gameId
                if(!gameId){
                    return;
                }

                const availableGame = this.games.find(game => game.gameId === gameId)

                const gameFromDb = await db.game.findUnique({
                    where: { id: gameId, }, include: {
                        moves: {
                            orderBy: {
                                moveNumber: "asc"
                            }
                        },
                        blackPlayer: true,
                        whitePlayer: true
                    }
                })

                if(!gameFromDb){
                    user.socket.send(JSON.stringify({
                        type: GAME_NOT_FOUND,
                    }));    
                    return;
                }

                if(availableGame){
                    const game = new Game(gameFromDb?.whitePlayerId!, gameFromDb?.blackPlayerId!);
                    gameFromDb?.moves.forEach((move) => {
                        if(isPromoting(game.board, move.from as Square, move.to as Square)){
                            game.board.move({
                                from: move.from,
                                to: move.to,
                                promotion: 'q'
                            });
                        } else {
                            game.board.move({
                                from: move.from,
                                to: move.to,
                            });
                        }
                    });
                    this.games.push(game);  
                }

                user.socket.send(JSON.stringify({
                    type: GAME_JOINED,
                    payload: {
                        gameId,
                        moves: gameFromDb.moves,
                        blackPlayer: {
                            id: gameFromDb.blackPlayer.id,
                            name: gameFromDb.blackPlayer.name
                        },
                        whitePlayer: {
                            id: gameFromDb.whitePlayer.id,
                            name: gameFromDb.whitePlayer.name
                        }
                    }
                }));    

                SocketManager.getInstance().addUser(user, gameId)



            }
        })
    }
}