import { use, useEffect, useState } from "react"
import { Button } from "../components/Button"
import { ChessBoard, isPromoting } from "../components/ChessBoard"
import { useSocket } from "../hooks/useSocket"
import { Chess, Move } from "chess.js";
import { useNavigate, useParams } from "react-router-dom";
import type { User } from "../store/src/atoms/user";
import { useUser } from "../store/src/hooks/useUser";
import { MovesTable } from "../components/MovesTable"

export const INIT_GAME = "init_game";
export const MOVE = "move";
export const GAME_OVER = "game_over";
export const OPPONENT_DISCONNECTED = "opponent_disconnected"
export const JOIN_ROOM = "join_room";
export const GAME_NOT_FOUND = "game_not_found";
export const GAME_JOINED = "game_joined";


interface Metadata {
    blackPlayer: {id: string, name: string};
    whitePlayer: {id: string, name: string};
}

function generateSanMoves(moves: { from: string; to: string; promotion?: string }[]) {
  const chess = new Chess();
  return moves.map(move => {
    const result = chess.move(move);
    if (!result) {
      throw new Error("Invalid move while generating SAN");
    }
    return result.san;
  });
}

export const Game = () => {

    const socket = useSocket()
    const {gameId} = useParams();
    const user = useUser();

    const navigate = useNavigate();
    const [chess, setChess] = useState(new Chess());
    const [board, setBoard] = useState(chess.board());
    const [started, setStarted] = useState(false);
    const [color, setColor] = useState<"w" | "b" | null>(null);
    const [gameMetadata, setGameMetadata] = useState<Metadata | null>(null);
    const [result, setResult] = useState<"WHITE_WINS" | "BLACK_WINS" | "DRAW" | typeof OPPONENT_DISCONNECTED | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const sanMoves = generateSanMoves(moves);

    useEffect(() => {
        if(!socket){
            return;
        }
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data)
            
            switch (message.type) {
                case INIT_GAME:
                    setBoard(chess.board())
                    setColor(message.payload.color)
                    setStarted(true);
                    navigate(`/game/${message.payload.gameId}`)
                    setGameMetadata({
                        blackPlayer: message.payload.blackPlayer,
                        whitePlayer: message.payload.whitePlayer,
                    })
                    break;
                case MOVE:
                    const move = message.payload;
                    // const moves = chess.moves({verbose: true});
                    // if(moves.map(x => JSON.stringify(x)).includes(JSON.stringify(move)))return;
                    if(isPromoting(chess, move.from, move.to)){
                        chess.move({
                            from: move.from,
                            to: move.to,

                            promotion: 'q'
                        });
                    } else {
                        chess.move(move);
                    }
                    setBoard(chess.board());
                    
                    setMoves(moves => [...moves, move]);


                    // setMoveCount(chess.history().length);
                    break;
                case GAME_OVER:
                    setResult(message.payload.result);
                    break;
            
                case OPPONENT_DISCONNECTED:
                    setResult(OPPONENT_DISCONNECTED);
                    break;
                
                case GAME_JOINED:
                    setGameMetadata({
                        blackPlayer: message.payload.blackPlayer,
                        whitePlayer: message.payload.whitePlayer
                    })
                    setStarted(true);
                    setMoves(message.payload.moves);
                    message.payload.moves.map(x => {
                        if(isPromoting(chess, x.from, x.to)){
                            chess.move({...x, promotion: 'q'})
                        } else {
                            chess.move(x);
                        }
                        
                    })
                    setBoard(chess.board());
                    break;
                    
            }
            
        }

        if(gameId !== "random"){
            socket.send(JSON.stringify({
                type: JOIN_ROOM,
                payload: {
                    gameId
                }
            }))
        }
    }, [chess, socket])


    if (!socket) return <div>Connecting...</div>

    

    return <div>
        <div className="flex justify-center text-white mt-4">
            {gameMetadata?.blackPlayer?.name} vs {gameMetadata?.whitePlayer?.name}
        </div>
        {result && <div className="flex justify-center text-white mt-4">
            {result}
        </div>}
        <div className="flex justify-center">
            <div className="pt-8 max-w-5xl flex justify-center w-full">
                <div className="grid grid-cols-6 gap-4">
                    <div className="col-span-4">
                        <ChessBoard lastMove={moves.at(-1)!} gameId  ={gameId ?? ""} chess={chess} setBoard={setBoard} socket={socket} board = {board} playColor = {user?.id === gameMetadata?.blackPlayer?.id ? "b" : "w"}/>
                    </div>
                    

                    <div className="col-span-2 justify-center bg-slate-900" >
                        
                        <div className=" text-white">
                            {started && <div>
                                    <div className="text-2xl justify-center flex mt-2 mb-4 underline">Moves Table</div>
                                    <div className="grid grid-cols-[50px_1fr_1fr] gap-2 items-center">
                                        <p>S. No.</p>
                                        <p>White</p>
                                        <p>Black</p>
                                    </div>
                                    <MovesTable sanMoves={sanMoves} currentMoveIndex={sanMoves.length - 1}/>
                                </div>
                            }
                        </div>
                        <div className="mt-10 flex justify-center">
                            {!started && gameId === "random" && <Button onClick={() => {
                                socket.send(JSON.stringify({
                                    type: INIT_GAME 
                                }))
                            }} >
                                Play Online
                            </Button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}