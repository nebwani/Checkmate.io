import { Chess, Move, type Color, type PieceSymbol, type Square } from "chess.js";
import { useState } from "react";
import { MOVE } from "../screens/Game.tsx";

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


export const ChessBoard = ({ gameId, chess, board, socket, setBoard, playColor , lastMove} : {
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
}) => {
    const [from, setFrom] = useState<null | Square>(null);
    const [to, setTo] = useState<null | Square>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const isMyTurn = playColor === chess.turn();
    const [legalMoves, setLegalMoves] = useState<Move[]>([]);
    const isBlack = playColor === "b";

    return <div>
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
                    // const squareRepresentation = String.fromCharCode(97 + (cellIndex % 8)) + "" + (8 - rowIndex) as Square
                    return <div onClick={() => {
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
                            setTo(null);
                        }
                        
                    }} key={cellIndex} className={`z-50 w-16 h-16 ${(rowIndex + cellIndex) %2 ===0 ? "bg-[#fdcf9e]" : "bg-[#c4864a]"} flex justify-center items-center` + (isActive && from === squareRepresentation ? " border-2 border-red-500 bg-red-200 " : "") + ((lastMove?.from === squareRepresentation || lastMove?.to === squareRepresentation)  ? " bg-red-900" :  "")}>
                        <div className="w-full justify-center flex h-full">
                            <div className="h-full justify-center flex items-center">
                                {
                                    cell ? <img className="w-16 h-16" src={`/${cell?.color === "b" ? cell?.type : `${cell?.type?.toUpperCase()} Copy`}.png`}/> : null
                                    
                                }

                                {
                                    ((!isBlack && rowIndex === 7) || (isBlack && rowIndex === 0)) ? <div className="absolute h-16 w-16 z-50 flex items-end justify-end"><div className="absolute w-5 h-5 z-50 text-right items-end text-[15px] font-mono font-extrabold">{squareRepresentation[0]}</div></div> : null
                                    
                                }
                                {
                                    ((!isBlack && cellIndex === 0) || (isBlack && cellIndex === 7)) ? <div className="absolute h-16 w-16 z-50 flex items-top justify-left"><div className="absolute w-5 h-5 z-50 text-left text-[15px] font-mono font-extrabold">{squareRepresentation[1]}</div></div> : null
                                }
                                
                                {legalMoves.some(m => m.to === squareRepresentation) && ( <div className=" h-4 w-4 rounded-full bg-black/30 pointer-events-none z+10 flex" /> )}
                                
                            </div>
                        </div>
                    </div>
                })}
            </div>
        })}        
    </div>
}
