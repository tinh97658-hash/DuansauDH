import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AuthSessionContext } from "../context/AuthSession";
import ProfilePicker from '../features/accounts/ProfilePicker';
import { permissionRoute,routeViewCode } from '../features/accounts/routePermissions';

const EMPTY_ACCESS = { permissions: [], roles: [] };
const CHANGE_PASSWORD_PATH = "/system/change-password";

const ProtectedRoute = () => {
  const location = useLocation();
  const navigate=useNavigate();
  const [status, setStatus] = useState("checking");
  const [session, setSession] = useState(null);
  const [access, setAccess] = useState(null);
  const [pickerOpen,setPickerOpen]=useState(false),[profileBusy,setProfileBusy]=useState(false),[profileError,setProfileError]=useState('');

  const loadSession = useCallback(async () => {
    setAccess(EMPTY_ACCESS);
    const { data } = await axios.get("/auth/session", { withCredentials: true });
    if (!data.authenticated) {
      setSession(null);
      setAccess(null);
      setStatus("anonymous");
      return false;
    }
    setSession(data);
    axios.defaults.headers=axios.defaults.headers||{};
    axios.defaults.headers.common=axios.defaults.headers.common||{};
    if(data.activeProfile?.id)axios.defaults.headers.common['X-Working-Profile-Id']=data.activeProfile.id;
    else delete axios.defaults.headers.common['X-Working-Profile-Id'];
    setStatus("authenticated");
    if(data.profileSelectionRequired){setAccess(EMPTY_ACCESS);return true;}
    try {
      const { data: permissions } = await axios.get("/accounts/me/permissions", { withCredentials: true });
      setAccess(permissions || EMPTY_ACCESS);
    } catch {
      setAccess(EMPTY_ACCESS);
    }
    return true;
  }, []);

  const selectProfile=async profileId=>{
    if(profileBusy)return;setProfileBusy(true);setProfileError('');
    try{
      await axios.post('/auth/profiles/select',{profileId},{withCredentials:true});
      await loadSession();setPickerOpen(false);navigate('/',{replace:true});
    }catch(error){setProfileError(error.response?.data?.message||'Không thể đổi hồ sơ làm việc.');}
    finally{setProfileBusy(false);}
  };
  const logoutProfile=async()=>{
    if(profileBusy)return;setProfileBusy(true);setProfileError('');
    try{await axios.post('/user/logout',{}, {withCredentials:true});setStatus('anonymous');}
    catch{setProfileError('Không thể đăng xuất. Vui lòng thử lại.');setProfileBusy(false);}
  };

  useEffect(() => {
    let mounted = true;
    loadSession().catch(() => mounted && setStatus("anonymous"));
    return () => {
      mounted = false;
    };
  }, [loadSession]);

  useEffect(()=>{
    const interceptor=axios.interceptors?.response?.use(response=>response,error=>{
      if(['PROFILE_SELECTION_REQUIRED','PROFILE_CONTEXT_CHANGED'].includes(error.response?.data?.code)){
        setStatus('checking');loadSession().catch(()=>setStatus('anonymous'));
      }
      return Promise.reject(error);
    });
    return()=>{if(interceptor!==undefined)axios.interceptors.response.eject(interceptor);};
  },[loadSession]);

  const value = useMemo(
    () => ({ ...(session || {}), access,currentPath:location.pathname, refresh: loadSession,chooseProfile:()=>setPickerOpen(true) }),
    [session, access, loadSession,location.pathname],
  );

  if (status === "checking") {
    return <main className="auth-checking" role="status">Đang kiểm tra phiên đăng nhập...</main>;
  }
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;

  // Nhân sự còn mật khẩu khởi tạo phải đổi trước khi sử dụng các chức năng khác.
  if (session?.user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <AuthSessionContext.Provider key={session?.activeProfile?.id||'no-profile'} value={value}>
    {(!session?.profileSelectionRequired||session?.user?.mustChangePassword)&&(
      permissionRoute(access?.routeCatalog,location.pathname)&&!access?.permissions?.includes(routeViewCode(permissionRoute(access?.routeCatalog,location.pathname).path))
      ? <main role="alert" className="auth-checking">Hồ sơ đang chọn không có quyền xem trang này. <button onClick={()=>navigate('/')}>Về trang chủ</button></main>
      : <Outlet/>)}
    <ProfilePicker open={!session?.user?.mustChangePassword&&(pickerOpen||session?.profileSelectionRequired===true)} profiles={session?.profiles||[]} activeProfile={session?.activeProfile}
      user={session?.user} busy={profileBusy} error={profileError} required={session?.profileSelectionRequired===true}
      onClose={()=>setPickerOpen(false)} onSelect={selectProfile} onLogout={logoutProfile}/>
  </AuthSessionContext.Provider>;
};

export default ProtectedRoute;
