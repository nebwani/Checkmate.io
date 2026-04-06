import { useEffect, useState, useRef } from "react"
import { Button } from "../components/Button"
import { ChessBoard} from "../components/ChessBoard"
import { useSocket } from "../hooks/useSocket"
import { Chess, Move } from "chess.js";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "../store/src/hooks/useUser";
import { MovesTable } from "../components/MovesTable"
import confetti from "canvas-confetti";
import ProfileIcon from "../components/ProfileIcon";


export const INIT_GAME = "init_game";
export const MOVE = "move";
export const GAME_OVER = "game_over";
export const OPPONENT_DISCONNECTED = "opponent_disconnected"
export const JOIN_ROOM = "join_room";
export const GAME_NOT_FOUND = "game_not_found";
export const GAME_JOINED = "game_joined";
export const OFFER_DRAW = "offer_draw";
export const ACCEPT_DRAW = "accept_draw";
export const DECLINE_DRAW = "decline_draw";


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

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";

    
  document.body.appendChild(canvas);

  const myConfetti = confetti.create(canvas, {
    resize: true,
    useWorker: true,
  });

  myConfetti({
    particleCount: 300,
    spread: 260,
    startVelocity: 30,
    origin: { y: 0.5 }
  });

  setTimeout(() => {
    document.body.removeChild(canvas);
  }, 4000);
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
    const [drawOfferedBy, setDrawOfferedBy] = useState<"w" | "b" | null>(null);
    const confettiPlayedRef = useRef(false);
    const sanMoves = generateSanMoves(moves);
    const audio = new Audio("/MoveSound.mp3");
    

    useEffect(() => {
    const interval = setInterval(() => {
        if(result){
            return;
        }
        if (chess.turn() === "w") {
        setWhiteTime(t => Math.max(0, t - 100));
        } else {
        setBlackTime(t => Math.max(0, t - 100));
        }
    }, 100);

    return () => clearInterval(interval);
    }, [chess.turn()]);

    useEffect(() => {
        if (!result || !user || !gameMetadata) return;
        if (confettiPlayedRef.current) return;

        const didWhiteWin =
            result === "WHITE_WINS" &&
            user.id === gameMetadata.whitePlayer.id;

        const didBlackWin =
            result === "BLACK_WINS" &&
            user.id === gameMetadata.blackPlayer.id;

        if (didWhiteWin || didBlackWin) {
            confettiPlayedRef.current = true;
            console.log("CONFETTI FIRED");
            fireConfetti();
        }
    }, [result, user, gameMetadata]);


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
                    const gameResult = message.payload.result;
                    setDrawOfferedBy(null);
                    setResult(gameResult);
                    setGameMetadata(prev => {
                        if (!prev) return prev;

                        return {
                        blackPlayer: {
                            ...prev.blackPlayer,
                            rating: message.payload.blackRating,
                        },
                        whitePlayer: {
                            ...prev.whitePlayer,
                            rating: message.payload.whiteRating,
                        },
                        };
                    });
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
                    if(message.payload.result){
                        setResult(message.payload.result);
                    }
                    break;

                case OFFER_DRAW:
                    setDrawOfferedBy(message.payload.from);
                    break;

                case DECLINE_DRAW:
                    setDrawOfferedBy(null);
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

    function startGame(mode: "CLASSICAL" | "RAPID" | "BLITZ" | "BULLET") {
        socket?.send(JSON.stringify({
            type: INIT_GAME,
            payload: { mode }
        }));
        setInitiated(true);
    }
    

    return <div className="min-h-screen bg-linear-to-br from-gray-900 via-gray-800 to-black text-white">

    {/* 🔝 TOP BAR */}
    <div className="absolute top-4 right-6 py-2">
        <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer hover:scale-105 transition">
            <ProfileIcon />
        </div>
    </div>

    {/* 🎮 GAME HEADER */}
    <div className="text-center mt-4">
        {result && (
            <p className="mt-2 text-xl font-bold text-green-400">
                {result}
            </p>
        )}
    </div>

    {/* 🧩 MAIN GRID */}
    <div className="max-w-7xl mx-auto py-6 grid grid-cols-1 md:grid-cols-3 gap-6 px-4">

        {/* ♟️ BOARD SECTION */}
        <div className="md:col-span-2 bg-gray-800/80 border border-gray-700 rounded-2xl p-4 shadow-xl">

            {/* Opponent */}
            <div className="flex justify-between items-center mb-2">
                <div>
                    <p className="font-semibold">
                        {color === "w" ? gameMetadata?.blackPlayer?.name : gameMetadata?.whitePlayer?.name}
                    </p>
                    <p className="text-sm text-gray-400">
                        {color === "w" ? gameMetadata?.blackPlayer?.rating : gameMetadata?.whitePlayer?.rating}
                    </p>
                </div>

                <div className="px-4 py-2 bg-gray-900 rounded-lg border border-gray-600 text-lg">
                    {color === "w" ? formatTime(blackTime) : formatTime(whiteTime)}
                </div>
            </div>

            {/* Board */}
            <div className="flex justify-center">
                <ChessBoard
                    lastMove={moves.at(-1)!}
                    gameId={gameId ?? ""}
                    chess={chess}
                    setBoard={setBoard}
                    socket={socket}
                    board={board}
                    playColor={user?.id === gameMetadata?.blackPlayer?.id ? "b" : "w"}
                    spectatorMode={
                        user?.id !== gameMetadata?.blackPlayer.id &&
                        user?.id !== gameMetadata?.whitePlayer.id
                    }
                />
            </div>

            {/* You */}
            <div className="flex justify-between items-center mt-2">
                <div>
                    <p className="font-semibold">
                        {color === "w" ? gameMetadata?.whitePlayer?.name : gameMetadata?.blackPlayer?.name}
                    </p>
                    <p className="text-sm text-gray-400">
                        {color === "w" ? gameMetadata?.whitePlayer?.rating : gameMetadata?.blackPlayer?.rating}
                    </p>
                </div>

                <div className="px-4 py-2 bg-gray-900 rounded-lg border border-gray-600 text-lg">
                    {color === "w" ? formatTime(whiteTime) : formatTime(blackTime)}
                </div>
            </div>
        </div>

        {/* 📊 SIDEBAR */}
        <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-4 shadow-xl flex flex-col gap-4">

            {/* Moves */}
            {started && (
                <>
                    <h3 className="text-lg font-semibold border-b border-gray-700 pb-2">
                        Moves
                    </h3>

                    <div className="max-h-75 overflow-y-auto">
                        <MovesTable
                            sanMoves={sanMoves}
                            currentMoveIndex={sanMoves.length - 1}
                        />
                    </div>
                </>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 mt-2">

                {started && !result && (
                    <button
                        onClick={() =>
                            socket.send(JSON.stringify({
                                type: "resign",
                                payload: { gameId }
                            }))
                        }
                        className="bg-red-600 hover:bg-red-700 py-2 rounded-lg font-semibold"
                    >
                        Resign
                    </button>
                )}

                {started && !result && !drawOfferedBy && (
                    <Button onClick={() => {
                        socket.send(JSON.stringify({
                            type: "offer_draw",
                            payload: { gameId }
                        }))
                    }}>
                        Offer Draw
                    </Button>
                )}

                {drawOfferedBy && drawOfferedBy !== color && !result && (
                    <div className="flex gap-2">
                        <Button onClick={() => socket.send(JSON.stringify({
                            type: "accept_draw",
                            payload: { gameId }
                        }))}>
                            Accept
                        </Button>

                        <Button onClick={() => socket.send(JSON.stringify({
                            type: "decline_draw",
                            payload: { gameId }
                        }))}>
                            Decline
                        </Button>
                    </div>
                )}
            </div>

            {/* Game Modes */}
            {!initiated && gameId === "random" && (
                <div className="flex flex-col gap-3 mt-4">
                    <p className="text-center font-semibold">Select Mode</p>
                    <Button onClick={() => startGame("CLASSICAL")}>Classical</Button>
                    <Button onClick={() => startGame("RAPID")}>Rapid</Button>
                    <Button onClick={() => startGame("BLITZ")}>Blitz</Button>
                    <Button onClick={() => startGame("BULLET")}>Bullet</Button>
                </div>
            )}

            {initiated && !started && (
                <p className="text-center text-gray-400">Connecting...</p>
            )}
        </div>

    </div>
</div>
}