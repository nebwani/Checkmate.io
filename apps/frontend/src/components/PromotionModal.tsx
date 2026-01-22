import type { Color, PieceSymbol } from 'chess.js'  

const pieces: PieceSymbol[] = ["q", "r", "b", "n"]

const PromotionModal = ({color, onSelect} : {color: Color; onSelect: (piece: PieceSymbol) => void;}) => {
  return (
    <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-150'>
      <div className='bg-white rounded-lg p-4 flex gap-4 z-150'>
        {
            pieces.map(piece => (
                <button key={piece} onClick={() => onSelect(piece)} className='z-50 w-12 h-12 md:w-16 md:h-16 hover: scale-110 transition'>
                    <img className='z-50 w-12 h-12 md:w-16 md:h-16 ' src={`/${color === 'b' ? piece : piece.toUpperCase() + " Copy"}.png`}/>
                </button>
            ))
        }
      </div>
    </div>
  )
}

export default PromotionModal
