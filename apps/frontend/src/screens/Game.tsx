import { useEffect, useState } from "react"
import { Button } from "../components/Button"
import { ChessBoard} from "../components/ChessBoard"
import { useSocket } from "../hooks/useSocket"
import { Chess, Move } from "chess.js";
import { useNavigate, useParams } from "react-router-dom";
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
    blackPlayer: {id: string, name: string, rating: number};
    whitePlayer: {id: string, name: string, rating: number};
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
    const [chess] = useState(new Chess());
    const [board, setBoard] = useState(chess.board());
    const [started, setStarted] = useState(false);
    const [initiated, setInitiated] = useState(false);
    const [color, setColor] = useState<"w" | "b" | null>(null);
    const [gameMetadata, setGameMetadata] = useState<Metadata | null>(null);
    const [result, setResult] = useState<"WHITE_WINS" | "BLACK_WINS" | "DRAW" | typeof OPPONENT_DISCONNECTED | null>(null);
    const [moves, setMoves] = useState<Move[]>([]);
    const [whiteTime, setWhiteTime] = useState(0);
    const [blackTime, setBlackTime] = useState(0);
    const sanMoves = generateSanMoves(moves);
    const audio = new Audio("/MoveSound.mp3");
    

    useEffect(() => {
    const interval = setInterval(() => {
        if (chess.turn() === "w") {
        setWhiteTime(t => Math.max(0, t - 100));
        } else {
        setBlackTime(t => Math.max(0, t - 100));
        }
    }, 100);

    return () => clearInterval(interval);
    }, [chess.turn()]);


    useEffect(() => {
        if(!socket){
            return;
        }
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data)
            
            switch (message.type) {
                case INIT_GAME:
                    setBoard(chess.board())
                    setStarted(true);
                    setWhiteTime(10*60*1000);
                    setBlackTime(10*60*1000);
                    // setInitiated(false);
                    navigate(`/game/${message.payload.gameId}`)
                    setGameMetadata({
                        blackPlayer: message.payload.blackPlayer,
                        whitePlayer: message.payload.whitePlayer,
                    })
                    setColor(user?.id === message.payload.blackPlayer.id ? "b" : "w");
                    break;
                case MOVE:
                    const move = message.payload.move;
                    console.log(message.payload);
                    // const moves = chess.moves({verbose: true});
                    // if(moves.map(x => JSON.stringify(x)).includes(JSON.stringify(move)))return;
                    // const { from, to } = move;
                    
                    if (
                       (user?.id === gameMetadata?.whitePlayer.id && moves.length%2 === 0) ||  (user?.id === gameMetadata?.blackPlayer.id && moves.length%2 === 1)
                    ) {
                        // just sync clocks
                        setMoves(m => [...m, move]);
                        setWhiteTime(message.payload.whiteTime);
                        setBlackTime(message.payload.blackTime);
                        break;
                    }

                    // opponent move → apply
                    setMoves(m => [...m, move]);
                    chess.move(move);
                    setBoard(chess.board());
                    audio.play();

                    setWhiteTime(message.payload.whiteTime);
                    setBlackTime(message.payload.blackTime);

                    

                    // setMoveCount(chess.history().length);
                    break;
                case GAME_OVER:
                    setResult(message.payload.result);
                    setGameMetadata({
                        blackPlayer: {id: gameMetadata?.blackPlayer?.id!, name: gameMetadata?.blackPlayer?.name!, rating: message.payload.blackRating},
                        whitePlayer: {id: gameMetadata?.whitePlayer?.id!, name: gameMetadata?.whitePlayer?.name!, rating: message.payload.whiteRating}
                    })
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
                    message.payload.moves.map((x: Move) => {
                        // if(isPromoting(chess, x.from, x.to)){
                        //     chess.move({...x, promotion: 'q'})
                        // } else {
                        //     chess.move(x);
                        // }
                        chess.move(x);
                        
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
        <div className="flex justify-center text-white pt-4">
            {gameMetadata?.whitePlayer?.name} vs {gameMetadata?.blackPlayer?.name}
        </div>
        {result && <div className="flex justify-center text-white mt-4">
            {result}
        </div>}
        <div className="flex justify-center">
            <div className="pt-8 max-w-5xl flex justify-center w-full">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    
                    <div className="md:col-span-4 flex flex-col">
                        <div className="mb-2 flex justify-end p-1">
                            <div className="mr-auto px-2">
                                <div className="text-white text-l flex items-center justify-center">
                                    {color === "w" ? gameMetadata?.blackPlayer?.name : gameMetadata?.whitePlayer?.name}
                                </div>
                                <div className="text-white text-[12px]">
                                    {color === "w" ? gameMetadata?.blackPlayer?.rating : gameMetadata?.whitePlayer?.rating}
                                </div>
                                
                            </div>
                            <div className="ml-auto px-2">
                                <div className={`w-20 h-10 border text-white text-xl flex items-center justify-center rounded ${chess.turn() !== color ? " border-3 border-red-500" : ""}`}>
                                    {color === "w" ? formatTime(blackTime) : formatTime(whiteTime)}
                                </div>
                                
                            </div>
                            
                        </div>
                        <div className={`flex items-center justify-center ${!started ? "pointer-events-none" : ""}`}>
                            <ChessBoard lastMove={moves.at(-1)!} gameId  ={gameId ?? ""} chess={chess} setBoard={setBoard} socket={socket} board = {board} playColor = {user?.id === gameMetadata?.blackPlayer?.id ? "b" : "w"} spectatorMode = {user?.id !== gameMetadata?.blackPlayer.id && user?.id !== gameMetadata?.whitePlayer.id}/>
                        </div>
                        <div className="flex mt-2 justify-end p-1">
                            <div className="mr-auto px-2">
                                <div className="text-white text-l flex items-center justify-center">
                                    {color === "w" ? gameMetadata?.whitePlayer?.name : gameMetadata?.blackPlayer?.name}
                                </div>
                                <div className="text-white text-[12px]">
                                    {color === "w" ? gameMetadata?.whitePlayer?.rating : gameMetadata?.blackPlayer?.rating}
                                </div>
                                
                            </div>          
                            <div className="ml-auto px-2">
                                <div className={`w-20 h-10 border text-white text-xl flex items-center justify-center rounded ${chess.turn() === color ? " border-2 border-red-500" : ""}`}>
                                    {color === "w" ? formatTime(whiteTime) : formatTime(blackTime)}
                                </div>
                                
                            </div>          
                        </div>
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
                            {!initiated && gameId === "random" && <Button onClick={() => {
                                socket.send(JSON.stringify({
                                    type: INIT_GAME 
                                }))
                                setInitiated(true);
                            }} >
                                Play Online
                            </Button>}
                        </div>
                        <div className="flex justify-center text-white">
                            {initiated && !started && <div> Connecting... </div>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
}