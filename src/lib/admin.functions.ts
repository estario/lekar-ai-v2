import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

async function requireAdmin(context:any){
 const {data,error}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(error||!data)throw new Error('Нямате администраторски достъп.');
}
export const listAdminUsers=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
 await requireAdmin(context);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await supabaseAdmin.auth.admin.listUsers({page:1,perPage:100});
 if(error)throw new Error('Не може да се заредят потребителите.');
 const {data:roles,error:rolesError}=await supabaseAdmin.from('user_roles').select('user_id,role');
 if(rolesError)throw new Error('Не може да се заредят ролите.');
 return data.users.map(user=>({id:user.id,email:user.email||'',created_at:user.created_at,admin:!!roles?.some(role=>role.user_id===user.id&&role.role==='admin'),clinician:!!roles?.some(role=>role.user_id===user.id&&role.role==='clinician')}));
});
export const setAdminRole=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({userId:z.string().uuid(),admin:z.boolean()}).parse(input))
 .handler(async ({context,data})=>{
  await requireAdmin(context);
  if(data.userId===context.userId&&!data.admin)throw new Error('Не можете да премахнете собствените си администраторски права.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:user,error:userError}=await supabaseAdmin.auth.admin.getUserById(data.userId);
  if(userError||!user.user)throw new Error('Потребителят не е намерен.');
  const result=data.admin?await supabaseAdmin.from('user_roles').upsert({user_id:data.userId,role:'admin'}):await supabaseAdmin.from('user_roles').delete().eq('user_id',data.userId).eq('role','admin');
  if(result.error)throw new Error('Ролята не беше променена.');
  return {ok:true};
 });

/** Explicit admin approval of a clinician; never granted automatically at signup. */
export const setClinicianRole=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((input:unknown)=>z.object({userId:z.string().uuid(),clinician:z.boolean()}).parse(input))
 .handler(async ({context,data})=>{
  await requireAdmin(context);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:user,error:userError}=await supabaseAdmin.auth.admin.getUserById(data.userId);
  if(userError||!user.user)throw new Error('Потребителят не е намерен.');
  const result=data.clinician?await supabaseAdmin.from('user_roles').upsert({user_id:data.userId,role:'clinician'}):await supabaseAdmin.from('user_roles').delete().eq('user_id',data.userId).eq('role','clinician');
  if(result.error)throw new Error('Ролята не беше променена.');
  return {ok:true};
 });
