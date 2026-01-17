import { Chess, type Square } from "chess.js";
import type WebSocket from "ws";
import { GAME_OVER, INIT_GAME, MOVE } from "./messages.js";
import{db} from "@repo/db"
import { randomUUID } from "crypto"
import { SocketManager, type User } from "./SocketManager.js"

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
    private startTime: Date

    constructor(player1UserId: string, player2UserId: string | null){
        this.player1UserId = player1UserId;
        this.player2UserId = player2UserId;
        this.board = new Chess();
        this.moveCount = 0;
        this.startTime = new Date()
        this.gameId = randomUUID();

    }

    async updateSecondPlayer(player2UserId: string) {
        this.player2UserId = player2UserId;
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

        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
        type: INIT_GAME,
        payload: {
            gameId: this.gameId,
            whitePlayer: { name: users.find(user => user.id === this.player1UserId)?.name, id: this.player1UserId },
            blackPlayer: { name: users.find(user => user.id === this.player2UserId)?.name, id: this.player2UserId },
            fen: this.board.fen(),
            moves:[]
        }
        }))  

    }

    

    async createGameInDb(){
        const now = BigInt(Date.now())
        const game = await db.game.create({
            data: {
                id: this.gameId,
                timeControl: "CLASSICAL",
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
                white_time: 10*1000,
                black_time: 10*1000,
                last_move_at: now,
            },
            include: {
                whitePlayer: true,
                blackPlayer: true,
            }   
        })
        this.gameId = game.id
    }

    async addMoveToDb(move: {
        from: string;
        to: string;
    }) {

        await db.$transaction([
            db.move.create({
                data: {
                    gameId: this.gameId,
                    moveNumber: this.moveCount + 1,
                    from: move.from,
                    to: move.to,
                    startFen: this.board.fen(),
                    endFen: this.board.fen(),
                    createdAt: new Date(Date.now()),
                },
            }), 
            db.game.update({
                data: {
                    currentFen: this.board.fen()
                },
                where: {
                    id: this.gameId
                }
            })
        ])
    }

    async makeMove(user: User, move: {
        from: Square,
        to: Square
    }){
        //validations
        //is it the same users move
        //is the move valid
        // if(this.moveCount %2 ===0 && user.userId !== this.player1UserId){
        //     return ;
        // }
        // if(this.moveCount %2 ===1 && user.userId !== this.player2UserId){
        //     return ;
        // }
        const cur_game = await db.game.findUnique({
            where: {id: this.gameId}
        });
        if(!cur_game) {
            return;
        }
        const now = Date.now();
        const elapsed = Number(BigInt(now) - cur_game.last_move_at);

        if (this.moveCount%2 === 0) {
            cur_game.white_time -= elapsed;
        } else {
            cur_game.black_time -= elapsed;
        }

        if (cur_game.white_time <= 0) {
            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: GAME_OVER,
                payload: {
                    result: "BLACK_WINS_ON_TIME"
                }
            }))
            await db.game.update({
                data: {
                    result: "BLACK_WINS",
                    status: "COMPLETED"
                },      
                where: {
                    id: this.gameId,

                }
            })
            return;
        }

        if (cur_game.black_time <= 0) {
            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: GAME_OVER,
                payload: {
                    result: "WHITE_WINS_ON_TIME"
                }
            }))
            await db.game.update({
                data: {
                    result: "WHITE_WINS",
                    status: "COMPLETED"
                },      
                where: {
                    id: this.gameId,

                }
            })
            return;
        }
        await db.game.update({
            where: { id: this.gameId },
            data: {
                white_time: cur_game.white_time,
                black_time: cur_game.black_time,
                last_move_at: now,
            },
        });

        try {
            if(isPromoting(this.board, move.from, move.to)){
                this.board.move({
                    from: move.from,
                    to: move.to,
                    promotion: 'q',
                });
            } else {
                this.board.move({
                    from: move.from,
                    to: move.to,
                });
            }

        } catch (error) {
            console.log(error);
            
            return;
        }

        await this.addMoveToDb(move);
        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
            type: MOVE,
            payload: {
                move,
                whiteTime: cur_game.white_time,
                blackTime: cur_game.black_time,
            }
        }))

        if(this.board.isGameOver()){
            const result = this.board.isDraw() ? "DRAW" : this.board.turn() === 'w' ? "BLACK_WINS" : "WHITE_WINS";

            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: GAME_OVER,
                payload: {
                    result
                }
            }))

            await db.game.update({
                data: {
                    result,
                    status: "COMPLETED"
                },      
                where: {
                    id: this.gameId,

                }
            })
        }

        

        this.moveCount++;
        
        //update the board
        //push the move
        //check if the game is over

        //send the updated board to both players
    }
}
    