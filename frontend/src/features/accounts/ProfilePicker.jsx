import React from 'react';
import {Alert,Box,Button,Chip,Stack,Typography} from '@mui/material';
import AppDialog from '../../components/AppDialog';

export default function ProfilePicker({open,profiles=[],activeProfile,user,onSelect,onClose,onLogout,busy,error,required=false}){
  return <AppDialog open={open} onClose={required?undefined:onClose} showCloseButton={!required} title="CHỌN HỒ SƠ LÀM VIỆC"
    maxWidth="sm" saving={busy} actions={<>{!required&&<Button disabled={busy} onClick={onClose}>Hủy</Button>}<Button disabled={busy} onClick={onLogout}>Đăng xuất</Button></>}>
    <Stack spacing={1.5}>
      <Typography>Chọn tư cách làm việc của {user?.name||'tài khoản'}. Mỗi phiên chỉ sử dụng quyền của một hồ sơ.</Typography>
      {error&&<Alert severity="error">{error}</Alert>}
      {!profiles.length&&<Alert severity="warning">Tài khoản chưa có hồ sơ đang hoạt động. Vui lòng liên hệ quản trị viên.</Alert>}
      {profiles.map(profile=><Box component="button" type="button" key={profile.id} disabled={busy} onClick={()=>onSelect(profile.id)}
        aria-label={`Làm việc với ${profile.name}`} sx={{textAlign:'left',p:1.75,border:'1px solid',borderColor:profile.id===activeProfile?.id?'#0788B8':'#DCE6EF',borderRadius:1.5,bgcolor:profile.id===activeProfile?.id?'#EFF8FC':'#fff',cursor:'pointer','&:hover':{bgcolor:'#F4F9FC'}}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontWeight={700}>{profile.name}</Typography>
          {profile.id===activeProfile?.id&&<Chip size="small" label="Đang dùng"/>}</Stack>
        <Typography variant="body2" color="text.secondary">{profile.scopeLabel}{profile.readOnly?' · Chỉ xem':''}</Typography>
      </Box>)}
    </Stack>
  </AppDialog>;
}
