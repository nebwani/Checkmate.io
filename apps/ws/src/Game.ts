import { Chess, type Square } from "chess.js";
import type WebSocket from "ws";
import { GAME_OVER, INIT_GAME, MOVE } from "./messages.js";
import{db} from "@repo/db"
import { randomUUID } from "crypto"
import { SocketManager, type User } from "./SocketManager.js"
import { calculateElo } from "./elo.js";
import { getRedis } from "./redis.js";

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
            whiteTime: 10 * 60 * 1000,
            blackTime: 10 * 60 * 1000,
            lastMoveAt: Date.now(),
            moveCount: 0,
            fen: this.board.fen(),
        });

        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
        type: INIT_GAME,
        payload: {
            gameId: this.gameId,
            whitePlayer: { name: users.find(user => user.id === this.player1UserId)?.name, id: this.player1UserId, rating: users.find(user => user.id === this.player1UserId)?.rating},
            blackPlayer: { name: users.find(user => user.id === this.player2UserId)?.name, id: this.player2UserId, rating: users.find(user => user.id === this.player2UserId)?.rating},
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
                white_time: 10*60*1000,
                black_time: 10*60*1000,
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
        promotion?: string;
    }) {

        await db.$transaction([
            db.move.create({
                data: {
                    gameId: this.gameId,
                    moveNumber: this.moveCount + 1,
                    from: move.from,
                    to: move.to,
                    promotion: move.promotion ?? null,
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
        to: Square,
        promotion?: string
    }){
        if(user.userId !== this.player1UserId && user.userId !== this.player2UserId){
            return;
        }
        //validations
        //is it the same users move
        //is the move valid
        // if(this.moveCount %2 ===0 && user.userId !== this.player1UserId){
        //     return ;
        // }
        // if(this.moveCount %2 ===1 && user.userId !== this.player2UserId){
        //     return ;
        // }
        const redis = getRedis();

        const state = await redis.hgetall(`game:${this.gameId}`);

        if (!state || !state.lastMoveAt) {
        console.log("Redis game state missing");
        return;
        }

        let whiteTime = Number(state.whiteTime);
        let blackTime = Number(state.blackTime);
        let lastMoveAt = Number(state.lastMoveAt);
        let moveCount = Number(state.moveCount);
        this.moveCount = moveCount;

        const now = Date.now();
        const elapsed = now - lastMoveAt;

        


        try {
            if(isPromoting(this.board, move.from, move.to)){
                this.board.move({
                    from: move.from,
                    to: move.to,
                    promotion: move.promotion ?? 'q',
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

        if (moveCount % 2 === 0) {
        whiteTime -= elapsed;
        } else {
        blackTime -= elapsed;
        }

        await redis.hset(`game:${this.gameId}`, {
            whiteTime,
            blackTime,
            lastMoveAt: now,
            moveCount: moveCount + 1,
            fen: this.board.fen(),
        });


        if (whiteTime <= 0) {
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

        if (blackTime <= 0) {
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

        const t0 = Date.now()


        db.game.update({
            where: { id: this.gameId },
            data: {
                white_time: whiteTime,
                black_time: blackTime,
                last_move_at: now,
            },
        }).catch(err => console.error("DB clock update failed:", err));

        const t1 = Date.now()
        console.log("move logic:", t1 - t0)


        this.addMoveToDb(move).catch(err =>
        console.error("DB move write failed:", err)
        );

        const t2 = Date.now()
        console.log("db:", t2 - t1)
        SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
            type: MOVE,
            payload: {
                move,
                whiteTime: whiteTime,
                blackTime: blackTime,
            }
        }))

        if(this.board.isGameOver()){
            const result = this.board.isDraw() ? "DRAW" : this.board.turn() === 'w' ? "BLACK_WINS" : "WHITE_WINS";

            const white = await db.user.findUnique({
                where: { id: this.player1UserId },
            });

            const black = await db.user.findUnique({
                where: { id: this.player2UserId! },
            });

            if (!white || !black) return;

            const {newWhite, newBlack} = calculateElo(white.rating, black.rating, result);

            SocketManager.getInstance().broadcast(this.gameId, JSON.stringify({
                type: GAME_OVER,
                payload: {
                    result,
                    whiteRating: newWhite,
                    blackRating: newBlack
                }
            }))

            await db.$transaction([
                db.user.update({
                    where: { id: white.id },
                    data: { rating: newWhite },
                }),
                db.user.update({
                    where: { id: black.id },
                    data: { rating: newBlack },
                }),
                db.game.update({
                    data: {
                        result,
                        status: "COMPLETED"
                    },      
                    where: {
                        id: this.gameId,

                    }
                })
            ])

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
    