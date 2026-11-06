import { Chess, Move, type Color, type PieceSymbol, type Square } from "chess.js";
import { useEffect, useState } from "react";
import { MOVE } from "../screens/Game.tsx";
import { playMoveSound } from "../lib/sounds";
import PromotionModal from "./PromotionModal.tsx";

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


export const ChessBoard = ({ gameId, chess, board, socket, setBoard, playColor , lastMove, spectatorMode, gameOver} : {
    gameId: string | null   ;
    chess: Chess;
    setBoard: React.Dispatch<React.SetStateAction<({
        square: Square
        type: PieceSymbol
        color: Color
        } | null)[][]>>;
    board: ({
        square: Square;
        type: PieceSymbol;
        color: Color;
    } | null)[][],
    playColor: Color;
    socket: WebSocket;
    lastMove: {
        from: string
        to: string
    } | null
    spectatorMode: boolean;
    gameOver: boolean;
}) => {
    const [from, setFrom] = useState<null | Square>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const [legalMoves, setLegalMoves] = useState<Move[]>([]);
    const [promotion, setPromotion] = useState<{from: Square; to: Square;} | null>(null);
    const [dragFrom, setDragFrom] = useState<Square | null>(null);
    const isBlack = playColor === "b";

    useEffect(() => {
        if (!gameOver) return;
        setFrom(null);
        setLegalMoves([]);
        setIsActive(false);
        setDragFrom(null);
        setPromotion(null);
    }, [gameOver]);


    function handlePromotionSelect(piece: PieceSymbol) {
        if(!promotion) return;

        chess.move({
            from: promotion.from,
            to: promotion.to,
            promotion: piece
        });
        setBoard(chess.board());

        playMoveSound();

        socket.send(JSON.stringify({
            type: MOVE,
            payload: {
                gameId,
                move: {
                    from: promotion.from,
                    to: promotion.to,
                    promotion: piece
                }
            }
        }));

        setPromotion(null);
        setFrom(null);
        setLegalMoves([]);
    }


    return <div>
        {promotion && (<PromotionModal color={chess.turn()} onSelect={handlePromotionSelect}></PromotionModal>)}
        {(isBlack ? [...board].reverse() : board).map((row, rowIndex) => {
            return <div key={rowIndex} className="flex">
                {(isBlack ? [...row].reverse() : row).map((cell, cellIndex) => {
                    const file = isBlack
                        ? String.fromCharCode(97 + (7 - cellIndex)) // h → a
                        : String.fromCharCode(97 + cellIndex);      // a → h

                    const rank = isBlack
                        ? rowIndex + 1                              // 1 → 8
                        : 8 - rowIndex;                             // 8 → 1

                    const squareRepresentation = `${file}${rank}` as Square;
                    const isLight = (rowIndex + cellIndex) % 2 === 0;
                    const isSelected = isActive && from === squareRepresentation;
                    const isLastMove =
                        lastMove?.from === squareRepresentation || lastMove?.to === squareRepresentation;

                    const bg = isSelected ? "bg-red-300"
                            : isLastMove ? "bg-yellow-400/70"
                            : isLight ? "bg-[#fdcf9e]" : "bg-[#c4864a]";
                    // const squareRepresentation = String.fromCharCode(97 + (cellIndex % 8)) + "" + (8 - rowIndex) as Square
                    return <div onClick={() => {
                        
                        
                        // if(spectatorMode){
                        //     return;
                        // }
                        if (spectatorMode || gameOver) return;

                        if(playColor !== (chess.turn() === 'w' ? "w" : "b")){
                            return;
                        }
                        // if(!isMyTurn)return;

                        if(!from){
                            if (!["p", "q", "r", "n", "b", "k"].includes(cell?.type ?? "") || (cell?.color !== chess.turn())){ 
                                setFrom(null);
                                setLegalMoves([]);
                                return;
                            }   
                            

                            setIsActive(!isActive);
                            setFrom(squareRepresentation);
                            const moves = chess.moves({ square: squareRepresentation, verbose: true }) as Move[];
                            setLegalMoves(moves);

                        } else {
     
                            if(legalMoves.some(m => m.to === squareRepresentation)){

                                if (isPromoting(chess, from, squareRepresentation)) {
                                    setPromotion({ from, to: squareRepresentation });
                                    return;
                                }

                                chess.move({ from, to: squareRepresentation });
                                setBoard(chess.board());

                                playMoveSound();

    
                                socket.send(JSON.stringify({
                                    type: MOVE,
                                    payload: {
                                        gameId,
                                        move:{
                                            from,
                                            to: squareRepresentation
                                        }
                                    }
                                }))

                                setFrom(null);
                                setLegalMoves([]);
                                setIsActive(false);
                            } else{
                                setIsActive(false);
                                if (!["p", "q", "r", "n", "b", "k"].includes(cell?.type ?? "") || (cell?.color !== chess.turn())){ 
                                    setFrom(null);
                                    setLegalMoves([]);
                                    return;
                                }
                                else {
                                    setIsActive(true);
                                    setLegalMoves([]);
                                    setFrom(squareRepresentation);
                                    const moves = chess.moves({ square: squareRepresentation, verbose: true }) as Move[];
                                    setLegalMoves(moves);
                                }              
                                

                                
                            }
                            
                            setBoard(chess.board());
                        }

                        
                        
                    }} 

                    onDragOver={(e) => {
                    if (!dragFrom) return;
                    if (legalMoves.some(m => m.to === squareRepresentation)) {
                        e.preventDefault();
                    }
                    }}

                    onDrop={(e) => {
                    e.preventDefault();
                    if (gameOver) return;
                    if (!dragFrom) return;

                    if (!legalMoves.some(m => m.to === squareRepresentation)) return;

                    if (isPromoting(chess, dragFrom, squareRepresentation)) {
                        setPromotion({ from: dragFrom, to: squareRepresentation });
                        return;
                    }

                    chess.move({ from: dragFrom, to: squareRepresentation });
                    setBoard(chess.board());
                    playMoveSound();

                    socket.send(JSON.stringify({
                        type: MOVE,
                        payload: {
                        gameId,
                        move: {
                            from: dragFrom,
                            to: squareRepresentation
                        }
                        }
                    }));

                        setDragFrom(null);
                        setFrom(null);
                        setLegalMoves([]);
                        setIsActive(false);

                    }} key={cellIndex} className={`relative w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 flex justify-center items-center ${bg} ${isSelected ? "ring-2 ring-inset ring-red-500" : ""}`}>
                        <div className="w-full justify-center flex h-full">
                            <div className="h-full justify-center flex items-center">
                                {cell && (
                                <img
                                    // draggable={!spectatorMode && cell.color === chess.turn() && playColor === (chess.turn() === 'w' ? "w" : "b")}
                                    draggable={!spectatorMode && !gameOver && cell.color === chess.turn() && playColor === (chess.turn() === 'w' ? "w" : "b")}
                                    onDragStart={(e) => {
                                        // if (spectatorMode) return;
                                        if (spectatorMode || gameOver) return;
                                        if (cell.color !== chess.turn()) return;

                                        setDragFrom(squareRepresentation);
                                        setFrom(squareRepresentation);

                                        const moves = chess.moves({
                                            square: squareRepresentation,
                                            verbose: true
                                        }) as Move[];

                                        setLegalMoves(moves);
                                        e.dataTransfer.setData("text/plain", squareRepresentation);
                                    }}
                                    onDragEnd={() => {
                                        
                                        setDragFrom(null);
                                        setFrom(null);
                                        setLegalMoves([]);
                                    }}
                                    className="w-10 h-10 sm:w-14 sm:h-14 md:w-16 md:h-16 cursor-grab active:cursor-grabbing"
                                    src={`/${cell.color === "b" ? cell.type : `${cell.type.toUpperCase()} Copy`}.png`}
                                />
                                )}
                                {rowIndex === 7 && (
                                    <span className="absolute bottom-px right-0.5 text-[10px] md:text-sm font-mono font-bold text-black/70 pointer-events-none select-none">
                                        {file}
                                    </span>
                                )}
                                {cellIndex === 0 && (
                                    <span className="absolute top-px left-0.5 text-[10px] md:text-sm font-mono font-bold text-black/70 pointer-events-none select-none">
                                        {rank}
                                    </span>
                                )}
                                {legalMoves.some(m => m.to === squareRepresentation) && (
                                    <div className="absolute h-4 w-4 rounded-full bg-black/30 pointer-events-none" />
                                )}
                                
                            </div>
                        </div>
                    </div>
                })}
            </div>
        })}        
    </div>

    
}
