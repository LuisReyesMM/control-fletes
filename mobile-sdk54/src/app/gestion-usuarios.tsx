import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getFreshSession, supabase } from "../lib/supabase";

type Role = "reader" | "editor" | "superuser";
type Profile = { id:string; role:Role; active:boolean };
type UserRow = { id:string; email:string; full_name:string; role:Role; active:boolean; created_at:string; last_sign_in_at:string|null };
type UsersResponse = { ok?:boolean; users?:UserRow[]; user?:UserRow; error?:string };

const LOGIN_ROUTE = "/login" as Href;
const DASHBOARD_ROUTE = "/dashboard" as Href;
const ROLES: {value:Role; label:string}[] = [ {value:"reader",label:"Lector"}, {value:"editor",label:"Editor"}, {value:"superuser",label:"Superusuario"} ];

function roleLabel(role:Role){ return ROLES.find(r=>r.value===role)?.label ?? role; }
function initial(value:string){ return (value || "U").trim().charAt(0).toUpperCase(); }

export default function GestionUsuariosScreen(){
  const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false); const [users,setUsers]=useState<UserRow[]>([]); const [search,setSearch]=useState("");
  const [currentUserId,setCurrentUserId]=useState(""); const [editor,setEditor]=useState<UserRow|null>(null); const [createOpen,setCreateOpen]=useState(false);
  const [newName,setNewName]=useState(""); const [newEmail,setNewEmail]=useState(""); const [newPassword,setNewPassword]=useState(""); const [newRole,setNewRole]=useState<Role>("reader"); const [saving,setSaving]=useState(false);
  const apiUrl=process.env.EXPO_PUBLIC_API_URL;

  const request = useCallback(async(path:string, options:RequestInit={})=>{
    if(!apiUrl) throw new Error("No está configurada EXPO_PUBLIC_API_URL.");
    const session=await getFreshSession();
    const response=await fetch(`${apiUrl.replace(/\/+$/,"")}${path}`, { ...options, headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}`, ...(options.headers ?? {}) } });
    const text=await response.text(); let data:UsersResponse={}; try{data=text?JSON.parse(text):{};}catch{}
    if(response.status===401){await supabase.auth.signOut(); router.replace(LOGIN_ROUTE); return null;}
    if(response.status===403){Alert.alert("Sin permisos",data.error ?? "No puedes administrar usuarios."); router.replace(DASHBOARD_ROUTE); return null;}
    if(!response.ok) throw new Error(data.error ?? `Error ${response.status}`);
    return data;
  },[apiUrl]);

  const loadUsers=useCallback(async()=>{ const data=await request("/api/admin/users"); if(data) setUsers(data.users ?? []); },[request]);

  useEffect(()=>{ let mounted=true; (async()=>{ try{ setLoading(true); const session=await getFreshSession(); setCurrentUserId(session.user.id); const {data:p,error}=await supabase.from("profiles").select("id, role, active").eq("id",session.user.id).single<Profile>(); if(error||!p||!p.active||p.role!=="superuser"){router.replace(DASHBOARD_ROUTE);return;} await loadUsers(); }catch(e){Alert.alert("Error",e instanceof Error?e.message:"No se pudieron cargar los usuarios.");}finally{if(mounted)setLoading(false);} })(); return()=>{mounted=false}; },[loadUsers]);

  async function refresh(){try{setRefreshing(true);await loadUsers();}catch(e){Alert.alert("Error",e instanceof Error?e.message:"No se pudo actualizar.");}finally{setRefreshing(false)}}
  async function createUser(){ if(!newName.trim()||!newEmail.trim()||newPassword.length<8){Alert.alert("Revisa los datos","Nombre, correo y una contraseña de al menos 8 caracteres son obligatorios.");return;} try{setSaving(true);await request("/api/admin/users",{method:"POST",body:JSON.stringify({full_name:newName.trim(),email:newEmail.trim(),password:newPassword,role:newRole})}); setCreateOpen(false);setNewName("");setNewEmail("");setNewPassword("");setNewRole("reader");await loadUsers();}catch(e){Alert.alert("No se pudo crear",e instanceof Error?e.message:"Ocurrió un error.");}finally{setSaving(false)}}
  async function saveUser(){ if(!editor)return; try{setSaving(true);await request(`/api/admin/users/${editor.id}`,{method:"PATCH",body:JSON.stringify({full_name:editor.full_name.trim(),role:editor.role,active:editor.active})});setEditor(null);await loadUsers();}catch(e){Alert.alert("No se pudo actualizar",e instanceof Error?e.message:"Ocurrió un error.");}finally{setSaving(false)}}
  function confirmDelete(user:UserRow){Alert.alert("Eliminar usuario",`¿Deseas eliminar a ${user.full_name || user.email}? Esta acción no se puede deshacer.`,[{text:"Cancelar",style:"cancel"},{text:"Eliminar",style:"destructive",onPress:()=>void deleteUser(user)}]);}
  async function deleteUser(user:UserRow){try{setSaving(true);await request(`/api/admin/users/${user.id}`,{method:"DELETE"});setEditor(null);await loadUsers();}catch(e){Alert.alert("No se pudo eliminar",e instanceof Error?e.message:"Ocurrió un error.");}finally{setSaving(false)}}

  const filtered=users.filter(u=>`${u.full_name} ${u.email} ${roleLabel(u.role)}`.toLowerCase().includes(search.trim().toLowerCase()));
  if(loading)return <View style={styles.loading}><ActivityIndicator size="large"/><Text style={styles.loadingText}>Cargando usuarios...</Text></View>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void refresh()}/>}>
    <Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Volver</Text></Pressable>
    <Text style={styles.eyebrow}>Administración</Text><Text style={styles.title}>Gestión de usuarios</Text><Text style={styles.subtitle}>Administra accesos, roles y estado de las cuentas.</Text>
    <Pressable style={styles.primaryButton} onPress={()=>setCreateOpen(true)}><Text style={styles.primaryText}>+ Nuevo usuario</Text></Pressable>
    <TextInput value={search} onChangeText={setSearch} placeholder="Buscar nombre, correo o rol" placeholderTextColor="#8E8E93" style={styles.search}/>
    <View style={styles.countRow}><Text style={styles.sectionTitle}>Usuarios</Text><Text style={styles.count}>{filtered.length}</Text></View>
    {filtered.map(user=><Pressable key={user.id} style={styles.card} onPress={()=>setEditor({...user})}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initial(user.full_name||user.email)}</Text></View><View style={styles.userInfo}><Text style={styles.name}>{user.full_name||"Sin nombre"}</Text><Text style={styles.email}>{user.email}</Text><View style={styles.metaRow}><View style={[styles.roleBadge,user.role==="superuser"&&styles.superBadge]}><Text style={[styles.roleText,user.role==="superuser"&&styles.superText]}>{roleLabel(user.role)}</Text></View><Text style={[styles.status,user.active?styles.active:styles.inactive]}>{user.active?"Activo":"Inactivo"}</Text></View></View><Text style={styles.arrow}>›</Text>
    </Pressable>)}
  </ScrollView>

  <UserModal visible={createOpen} title="Nuevo usuario" name={newName} email={newEmail} password={newPassword} role={newRole} active onName={setNewName} onEmail={setNewEmail} onPassword={setNewPassword} onRole={setNewRole} onActive={()=>{}} showEmail showPassword saving={saving} onClose={()=>setCreateOpen(false)} onSave={()=>void createUser()}/>
  <UserModal visible={!!editor} title="Editar usuario" name={editor?.full_name??""} email={editor?.email??""} password="" role={editor?.role??"reader"} active={editor?.active??false} onName={v=>setEditor(p=>p?{...p,full_name:v}:p)} onEmail={()=>{}} onPassword={()=>{}} onRole={v=>setEditor(p=>p?{...p,role:v}:p)} onActive={v=>setEditor(p=>p?{...p,active:v}:p)} saving={saving} onClose={()=>setEditor(null)} onSave={()=>void saveUser()} onDelete={editor&&editor.id!==currentUserId?()=>confirmDelete(editor):undefined}/>
  </SafeAreaView>;
}

function UserModal(props:{visible:boolean;title:string;name:string;email:string;password:string;role:Role;active:boolean;onName:(v:string)=>void;onEmail:(v:string)=>void;onPassword:(v:string)=>void;onRole:(v:Role)=>void;onActive:(v:boolean)=>void;showEmail?:boolean;showPassword?:boolean;saving:boolean;onClose:()=>void;onSave:()=>void;onDelete?:()=>void}){
  const [passwordVisible,setPasswordVisible]=useState(false);

  return <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
    <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle}/>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{props.title}</Text>
            <Pressable onPress={props.onClose}><Text style={styles.done}>Cerrar</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={styles.modalScroll}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput value={props.name} onChangeText={props.onName} style={styles.input}/>
            {props.showEmail&&<>
              <Text style={styles.label}>Correo</Text>
              <TextInput value={props.email} onChangeText={props.onEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input}/>
            </>}
            {!props.showEmail&&<>
              <Text style={styles.label}>Correo</Text>
              <View style={styles.readonly}><Text style={styles.readonlyText}>{props.email}</Text></View>
            </>}
            {props.showPassword&&<>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordWrap}>
                <TextInput value={props.password} onChangeText={props.onPassword} secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} style={styles.passwordInput}/>
                <Pressable onPress={()=>setPasswordVisible(v=>!v)} style={styles.eyeButton} hitSlop={8}>
                  <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={22} color="#64748B"/>
                </Pressable>
              </View>
            </>}
            <Text style={styles.label}>Rol</Text>
            <View style={styles.rolePicker}>{ROLES.map(r=><Pressable key={r.value} onPress={()=>props.onRole(r.value)} style={[styles.roleOption,props.role===r.value&&styles.roleOptionActive]}><Text style={[styles.roleOptionText,props.role===r.value&&styles.roleOptionTextActive]}>{r.label}</Text></Pressable>)}</View>
            {!props.showEmail&&<View style={styles.activeRow}><View><Text style={styles.activeTitle}>Cuenta activa</Text><Text style={styles.activeHint}>Permite iniciar sesión.</Text></View><Switch value={props.active} onValueChange={props.onActive}/></View>}
            <Pressable disabled={props.saving} style={[styles.save,props.saving&&{opacity:.6}]} onPress={props.onSave}>{props.saving?<ActivityIndicator color="#fff"/>:<Text style={styles.saveText}>Guardar</Text>}</Pressable>
            {props.onDelete&&<Pressable style={styles.delete} onPress={props.onDelete}><Text style={styles.deleteText}>Eliminar usuario</Text></Pressable>}
          </ScrollView>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F5F5F7"},container:{padding:20,paddingBottom:50},loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F5F7"},loadingText:{marginTop:12,color:"#6E6E73"},back:{color:"#007AFF",fontSize:17,marginBottom:18},eyebrow:{color:"#007AFF",fontWeight:"700"},title:{marginTop:5,fontSize:32,fontWeight:"800",color:"#1D1D1F"},subtitle:{marginTop:8,color:"#6E6E73",fontSize:15,lineHeight:21},primaryButton:{marginTop:24,height:50,borderRadius:14,backgroundColor:"#1D1D1F",alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"700",fontSize:15},search:{height:48,marginTop:16,borderWidth:1,borderColor:"#D1D1D6",borderRadius:14,backgroundColor:"#fff",paddingHorizontal:14,fontSize:15,color:"#1D1D1F"},countRow:{marginTop:26,marginBottom:10,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},sectionTitle:{fontSize:22,fontWeight:"800",color:"#1D1D1F"},count:{color:"#8E8E93"},card:{marginBottom:10,borderWidth:1,borderColor:"#E5E5EA",borderRadius:18,backgroundColor:"#fff",padding:14,flexDirection:"row",alignItems:"center"},avatar:{width:42,height:42,borderRadius:21,backgroundColor:"#F2F2F7",alignItems:"center",justifyContent:"center"},avatarText:{fontWeight:"700",color:"#636366"},userInfo:{flex:1,marginLeft:12},name:{fontSize:16,fontWeight:"700",color:"#1D1D1F"},email:{marginTop:2,fontSize:12,color:"#8E8E93"},metaRow:{marginTop:8,flexDirection:"row",alignItems:"center"},roleBadge:{paddingHorizontal:9,paddingVertical:4,borderRadius:999,backgroundColor:"#F2F2F7"},superBadge:{backgroundColor:"#EAF3FF"},roleText:{fontSize:11,fontWeight:"700",color:"#636366"},superText:{color:"#007AFF"},status:{marginLeft:8,fontSize:11,fontWeight:"700"},active:{color:"#258044"},inactive:{color:"#C0392B"},arrow:{fontSize:28,color:"#C7C7CC"},modalKeyboard:{flex:1},overlay:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,.28)"},sheet:{maxHeight:"90%",backgroundColor:"#fff",borderTopLeftRadius:26,borderTopRightRadius:26,padding:20},handle:{width:36,height:5,borderRadius:3,backgroundColor:"#D1D1D6",alignSelf:"center",marginBottom:14},modalScroll:{paddingBottom:34},sheetHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},sheetTitle:{fontSize:22,fontWeight:"800",color:"#1D1D1F"},done:{color:"#007AFF",fontWeight:"600"},label:{marginTop:12,marginBottom:6,color:"#3A3A3C",fontSize:13,fontWeight:"700"},input:{height:50,borderWidth:1,borderColor:"#D1D1D6",borderRadius:13,paddingHorizontal:14,color:"#1D1D1F",fontSize:15},passwordWrap:{height:50,borderWidth:1,borderColor:"#D1D1D6",borderRadius:13,paddingLeft:14,paddingRight:8,flexDirection:"row",alignItems:"center"},passwordInput:{flex:1,color:"#1D1D1F",fontSize:15},eyeButton:{width:38,height:44,alignItems:"center",justifyContent:"center"},readonly:{height:50,borderRadius:13,backgroundColor:"#F2F2F7",justifyContent:"center",paddingHorizontal:14},readonlyText:{color:"#6E6E73"},rolePicker:{flexDirection:"row",flexWrap:"wrap",gap:7},roleOption:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,borderWidth:1,borderColor:"#D1D1D6"},roleOptionActive:{backgroundColor:"#1D1D1F",borderColor:"#1D1D1F"},roleOptionText:{fontSize:12,fontWeight:"600",color:"#6E6E73"},roleOptionTextActive:{color:"#fff"},activeRow:{marginTop:18,paddingVertical:10,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},activeTitle:{fontSize:15,fontWeight:"700",color:"#1D1D1F"},activeHint:{fontSize:12,color:"#8E8E93",marginTop:2},save:{height:50,marginTop:18,borderRadius:14,backgroundColor:"#1D1D1F",alignItems:"center",justifyContent:"center"},saveText:{color:"#fff",fontWeight:"700"},delete:{height:48,marginTop:10,borderRadius:14,backgroundColor:"#FFF3F2",alignItems:"center",justifyContent:"center"},deleteText:{color:"#C0392B",fontWeight:"700"}
});
