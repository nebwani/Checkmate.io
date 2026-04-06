import { useNavigate } from "react-router-dom";
import { useUser } from "../store/src/hooks/useUser";

export const ProfileIcon = () => {

    const user = useUser();
    const navigate = useNavigate();

    const handleProfileClick = () => {
        if (!user) {
            navigate("/login");
        } else {
            navigate(`/user/${user.id}`);
        }
    };
  return (
    <div>
      <img onClick={handleProfileClick} src="/pfp.jpg" className="w-full h-full scale-160"/>
    </div>
  )
}

export default ProfileIcon
