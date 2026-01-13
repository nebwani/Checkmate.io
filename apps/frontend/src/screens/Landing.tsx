import { useNavigate } from "react-router-dom"
import { Button } from "../components/Button"


export const Landing = () => {
    const navigate = useNavigate()
    return <div className="flex justify-center">
        <div className="pt-8 max-w-5xl">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex justify-center">
                    <img className="max-w-96" src={"/chessboard.png"} alt="" />
                </div>
                <div className="pt-16">
                    <div className="flex justify-center">
                        <h1 className="text-4xl font-bold text-white">
                            Welcome to the Online Chess Game!
                        </h1>
                    </div>
                    <div className="mt-8 flex space-x-5 justify-center">
                        <Button onClick={() => {
                            navigate("/game/random")
                        }}>
                            Play Online
                        </Button>
                        <Button  onClick={() => {
                            navigate("/login")
                        }} >
                            Login
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
}