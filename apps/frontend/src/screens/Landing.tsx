import { useNavigate } from "react-router-dom"
import { userAtom } from "../store/src/atoms/user"

export const Landing = () => {
    const navigate = useNavigate()

    return (
        <div className="min-h-screen bg-linear-to-br from-gray-900 via-gray-800 to-black text-white flex items-center justify-center px-6">

            <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                {/* LEFT: IMAGE */}
                <div className="flex justify-center">
                    <img
                        className="w-full max-w-md rounded-2xl shadow-2xl border border-gray-700 hover:scale-105 transition duration-300"
                        src="/chessboard.png"
                        alt="Chess Board"
                    />
                </div>

                {/* RIGHT: CONTENT */}
                <div className="flex flex-col items-center md:items-start text-center md:text-left">

                    <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
                        CheckMate<span className="text-blue-500">.io</span>
                    </h1>

                    <p className="mt-4 text-lg text-gray-400 max-w-md">
                        Play chess online, challenge players worldwide, and sharpen your strategy in real-time.
                    </p>

                    <button
                        className="mt-8 w-full md:w-auto px-10 py-4 text-lg font-semibold bg-blue-500 hover:bg-blue-600 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all duration-300 hover:scale-105"
                        onClick={() => navigate(`${userAtom ? "/game/random" : "/login"}`)}
                    >
                        Get Started →
                    </button>

                </div>
            </div>
        </div>
    )
}