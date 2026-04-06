import { useSetRecoilState } from "recoil";
import { userAtom } from "../atoms/user";

export const useSetUser = () => {
    return useSetRecoilState(userAtom);
};