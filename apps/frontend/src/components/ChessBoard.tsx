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


export const ChessBoard = ({ gameId, chess, board, socket, setBoard, playColor } : {
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
}) => {
    const [from, setFrom] = useState<null | Square>(null);
    const [to, setTo] = useState<null | Square>(null);
    const [isActive, setIsActive] = useState<boolean>(false);
    const isMyTurn = playColor === chess.turn();
    const [legalMoves, setLegalMoves] = useState<Move[]>([]);

    return <div>
        {board.map((row, rowIndex) => {
            return <div key={rowIndex} className="flex">
                {row.map((cell, cellIndex) => {
                    const squareRepresentation = String.fromCharCode(97 + (cellIndex % 8)) + "" + (8 - rowIndex) as Square
                    return <div onClick={() => {
                        if(playColor !== (chess.turn() === 'w' ? "w" : "b")){
                            return;
                        }
                        // if(!isMyTurn)return;

                        if(!from){
                            if (!["p", "q", "r", "n", "b", "k"].includes(cell?.type ?? "") || (cell?.color !== chess.turn())){ 
                                setFrom(null);
                                return;
                            }   
                            

                            setIsActive(!isActive);
                            setFrom(squareRepresentation);
                            const moves = chess.moves({ square: squareRepresentation, verbose: true }) as Move[];
                            console.log("Legal moves from", squareRepresentation, moves);
                            setLegalMoves(moves);

                        } else {
     
                            try{
                                if(isPromoting(chess, from, squareRepresentation)){
                                    chess.move({
                                        from,
                                        to: squareRepresentation,
                                        promotion: 'q'
                                    });
                                } else {
                                    chess.move({
                                        from,
                                        to: squareRepresentation
                                    });
                                }
                                

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
                                setIsActive(false);
                                setLegalMoves([]);
                            } catch (e){
                                setIsActive(false);
                                if (!["p", "q", "r", "n", "b", "k"].includes(cell?.type ?? "") || (cell?.color !== chess.turn())){ 
                                    setFrom(null);
                                    return;
                                }
                                else {
                                    setIsActive(true);
                                    setFrom(squareRepresentation);
                                }              
                                
                                console.log(e);
                                
                            }
                            
                            setBoard(chess.board());
                            setTo(null);
                        }
                        
                    }} key={cellIndex} className={`w-16 h-16 ${(rowIndex + cellIndex) %2 ===0 ? "bg-[#fdcf9e]" : "bg-[#c4864a]"} flex justify-center items-center` + (isActive && from === squareRepresentation ? " border-4 border-red-500" : "")}>
                        <div className="w-full justify-center flex h-full">
                            <div className="h-full justify-center flex flex-col">
                                {
                                    cell ? <img className="w-16 h-16" src={`/${cell?.color === "b" ? cell?.type : `${cell?.type?.toUpperCase()} Copy`}.png`}/> : null
                                    
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
