type MovesTableProps = {
    sanMoves: string[];
    currentMoveIndex?: number;
}

export const MovesTable = ({
    sanMoves,
    currentMoveIndex,
}: MovesTableProps) => {
  return (
    <div className="bg-slate-900 text-white rounded-lg p-3 h-96 overflow-y-auto">
        <div className="space-y-1 text-sm font-mono">
            {
                sanMoves.map((san, i) => {
                    if(i%2 !== 0) return null;

                    const white = sanMoves[i];
                    const black = sanMoves[i+1];

                    const moveNumber = Math.floor(i / 2) + 1;

                    return (
                        <div
                            key = {i}
                            className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center"
                        >
                            <div className="text-gray-400">{moveNumber}.</div>

                            <div
                                className={`cursor-pointer px-1 rounded ${
                                currentMoveIndex === i ? "bg-yellow-600" : ""
                                }`}
                            >
                                {white}
                            </div>

                            {/* Black move */}
                            <div
                                className={`cursor-pointer px-1 rounded ${
                                currentMoveIndex === i + 1 ? "bg-yellow-600" : ""
                                }`}
                            >
                                {black ?? ""}
                            </div>

                        </div>
                    )
                })
            }
        </div>
    </div>
  )
}

export default MovesTable
