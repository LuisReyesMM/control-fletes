import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { getFreshSession, supabase } from "../lib/supabase";

type Role = "reader" | "editor" | "superuser";
type Profile = { role: Role; active: boolean };
type CatalogType = "UNIT" | "CLIENT" | "SERVICE_TYPE" | "CATEGORY" | "DESTINATION";
type CatalogOption = { id: string; catalog_type: CatalogType; value: string; label: string; active: boolean; sort_order: number };
type CustomField = { id: string; field_key: string; label: string; field_type: "text" | "number" | "date" | "boolean"; visible: boolean; required: boolean; sort_order: number };
type FreightService = {
  id: string; folio: string | number | null; service_date: string | null; unit: string | null; invoice: string | null;
  client: string | null; service_type: string | null; category: string | null; container: string | null; weight: number | null;
  destination: string | null; rodrigo_cash_freight: number | null; invoice_freight: number | null; carlos_cash_advance: number | null;
  carlos_invoice_payment: number | null; observations: string | null; custom_fields?: Record<string, unknown> | null;
};
type FormState = {
  service_date: string; unit: string; invoice: string; client: string; service_type: string; category: string; container: string;
  weight: string; destination: string; rodrigo_cash_freight: string; invoice_freight: string; carlos_cash_advance: string;
  carlos_invoice_payment: string; observations: string;
};
type SelectorState = { visible: boolean; title: string; field: keyof FormState | null; catalogType: CatalogType | null };

const LOGIN_ROUTE = "/login" as Href;
const FLETES_ROUTE = "/fletes" as Href;

function numberToString(value: number | null | undefined) { return value == null ? "" : String(value); }
function parseOptionalNumber(value: string, label: string): number | null {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`El campo "${label}" debe contener un número válido.`);
  return parsed;
}
function isValidDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value); }
function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, day || 1);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default function EditarFleteScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const freightId = typeof params.id === "string" ? params.id : "";
  const scrollRef = useRef<ScrollView | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [folio, setFolio] = useState<string | number | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});
  const [form, setForm] = useState<FormState>({ service_date:"", unit:"", invoice:"", client:"", service_type:"", category:"", container:"", weight:"", destination:"", rodrigo_cash_freight:"", invoice_freight:"", carlos_cash_advance:"", carlos_invoice_payment:"", observations:"" });
  const [selector, setSelector] = useState<SelectorState>({ visible:false, title:"", field:null, catalogType:null });

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        if (!freightId) throw new Error("No se recibió el ID del flete.");
        setLoading(true);
        const session = await getFreshSession();
        const user = session.user;
        const { data: profileData, error: profileError } = await supabase.from("profiles").select("role, active").eq("id", user.id).single<Profile>();
        if (profileError || !profileData || !profileData.active) { await supabase.auth.signOut(); router.replace(LOGIN_ROUTE); return; }
        if (profileData.role !== "editor" && profileData.role !== "superuser") { Alert.alert("Sin permisos", "Tu usuario no puede editar fletes."); router.replace(FLETES_ROUTE); return; }

        const [freightResult, catalogResult, customResult] = await Promise.all([
          supabase.from("freight_services").select("id, folio, service_date, unit, invoice, client, service_type, category, container, weight, destination, rodrigo_cash_freight, invoice_freight, carlos_cash_advance, carlos_invoice_payment, observations, custom_fields").eq("id", freightId).single<FreightService>(),
          supabase.from("freight_catalog_options").select("id, catalog_type, value, label, active, sort_order").eq("active", true).order("catalog_type").order("sort_order"),
          supabase.from("freight_custom_fields").select("id, field_key, label, field_type, visible, required, sort_order").eq("visible", true).order("sort_order"),
        ]);
        if (freightResult.error || !freightResult.data) throw new Error("No se pudo cargar el flete.");
        if (catalogResult.error) throw catalogResult.error;
        if (customResult.error) throw customResult.error;
        if (!mounted) return;

        const freight = freightResult.data;
        const fields = (customResult.data ?? []) as CustomField[];
        const currentCustom = freight.custom_fields ?? {};
        const initialCustom: Record<string, string | boolean> = {};
        fields.forEach((field) => {
          const raw = currentCustom[field.field_key];
          if (field.field_type === "boolean") initialCustom[field.field_key] = Boolean(raw);
          else initialCustom[field.field_key] = raw == null ? "" : String(raw);
        });

        setProfile(profileData); setFolio(freight.folio); setCatalogOptions((catalogResult.data ?? []) as CatalogOption[]); setCustomFields(fields); setCustomValues(initialCustom);
        setForm({
          service_date: freight.service_date ?? "", unit: freight.unit ?? "", invoice: freight.invoice ?? "", client: freight.client ?? "",
          service_type: freight.service_type ?? "", category: freight.category ?? "", container: freight.container ?? "", weight: numberToString(freight.weight),
          destination: freight.destination ?? "", rodrigo_cash_freight: numberToString(freight.rodrigo_cash_freight), invoice_freight: numberToString(freight.invoice_freight),
          carlos_cash_advance: numberToString(freight.carlos_cash_advance), carlos_invoice_payment: numberToString(freight.carlos_invoice_payment), observations: freight.observations ?? "",
        });
      } catch (error) { Alert.alert("Error", error instanceof Error ? error.message : "No se pudo cargar el flete."); }
      finally { if (mounted) setLoading(false); }
    }
    void loadData(); return () => { mounted = false; };
  }, [freightId]);

  const selectorOptions = useMemo(() => selector.catalogType ? catalogOptions.filter(o => o.catalog_type === selector.catalogType) : [], [catalogOptions, selector.catalogType]);
  function updateForm(field: keyof FormState, value: string) { setForm(p => ({ ...p, [field]: value })); }
  function updateCustomValue(fieldKey: string, value: string | boolean) { setCustomValues(p => ({ ...p, [fieldKey]: value })); }
  function openSelector(title: string, field: keyof FormState, catalogType: CatalogType) { setSelector({ visible:true, title, field, catalogType }); }
  function closeSelector() { setSelector({ visible:false, title:"", field:null, catalogType:null }); }
  function selectOption(value: string) { if (selector.field) updateForm(selector.field, value); closeSelector(); }

  function scrollToBottomField() {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 140);
  }

  function validateForm() {
    if (!form.service_date.trim()) return "La fecha es obligatoria.";
    if (!isValidDate(form.service_date.trim())) return "La fecha debe tener formato AAAA-MM-DD.";
    try {
      parseOptionalNumber(form.weight, "Peso");
      parseOptionalNumber(form.rodrigo_cash_freight, "Flete efectivo Rodrigo");
      parseOptionalNumber(form.invoice_freight, "Flete factura");
      parseOptionalNumber(form.carlos_cash_advance, "Anticipo efectivo Carlos");
      parseOptionalNumber(form.carlos_invoice_payment, "Pago factura Carlos");
      for (const field of customFields) {
        const value = customValues[field.field_key];
        if (field.required && field.field_type !== "boolean" && String(value ?? "").trim() === "") return `El campo "${field.label}" es obligatorio.`;
        if (field.field_type === "number" && String(value ?? "").trim()) parseOptionalNumber(String(value), field.label);
        if (field.field_type === "date" && String(value ?? "").trim() && !isValidDate(String(value))) return `El campo "${field.label}" debe tener formato AAAA-MM-DD.`;
      }
    } catch (error) { return error instanceof Error ? error.message : "Revisa los valores numéricos."; }
    return null;
  }

  async function performSave() {
    const validation = validateForm();
    if (validation) { Alert.alert("Revisa el formulario", validation); return; }
    try {
      setSaving(true);
      const session = await getFreshSession();
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("No está configurada EXPO_PUBLIC_API_URL.");
      const normalizedCustom: Record<string, unknown> = {};
      customFields.forEach((field) => {
        const value = customValues[field.field_key];
        normalizedCustom[field.field_key] = field.field_type === "number" ? parseOptionalNumber(String(value ?? ""), field.label) : value;
      });
      const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/fletes/${freightId}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${session.access_token}` },
        body: JSON.stringify({
          service_date: form.service_date.trim(), unit: form.unit, invoice: form.invoice, client: form.client, service_type: form.service_type,
          category: form.category, container: form.container, weight: parseOptionalNumber(form.weight,"Peso"), destination: form.destination,
          rodrigo_cash_freight: parseOptionalNumber(form.rodrigo_cash_freight,"Flete efectivo Rodrigo") ?? 0,
          invoice_freight: parseOptionalNumber(form.invoice_freight,"Flete factura") ?? 0,
          carlos_cash_advance: parseOptionalNumber(form.carlos_cash_advance,"Anticipo efectivo Carlos") ?? 0,
          carlos_invoice_payment: parseOptionalNumber(form.carlos_invoice_payment,"Pago factura Carlos") ?? 0,
          observations: form.observations, custom_fields: normalizedCustom,
        }),
      });
      const text = await response.text(); let result: { error?: string } = {};
      try { result = text ? JSON.parse(text) : {}; } catch {}
      if (!response.ok) throw new Error(result.error ?? `Error ${response.status}: ${text}`);
      setFeedbackTitle("Flete actualizado");
      setFeedbackMessage(`El flete ${folio ? `F-${String(folio).padStart(4,"0")}` : ""} se actualizó correctamente.`);
      setFeedbackVisible(true);
    } catch (error) { Alert.alert("No se pudo actualizar", error instanceof Error ? error.message : "Ocurrió un error."); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large"/><Text style={styles.loadingText}>Cargando flete...</Text></View>;
  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>← Volver</Text></Pressable>
          <Text style={styles.eyebrow}>Operación</Text><Text style={styles.title}>Editar flete</Text><Text style={styles.subtitle}>Folio {folio ?? "—"}</Text>

          <Text style={styles.section}>Servicio</Text>
          <View style={styles.group}>
            <Text style={styles.label}>Fecha</Text>
            <Pressable onPress={()=>setShowDatePicker(true)} style={styles.select}>
              <Text style={styles.selectText}>{form.service_date || "Seleccionar fecha"}</Text>
              <Ionicons name="calendar-outline" size={21} color="#007AFF"/>
            </Pressable>
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={form.service_date ? parseInputDate(form.service_date) : new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, selectedDate)=>{
                setShowDatePicker(false);
                if(selectedDate) updateForm("service_date", formatDateForInput(selectedDate));
              }}
            />
          )}
          <CatalogField label="Unidad" value={form.unit} onPress={()=>openSelector("Unidad","unit","UNIT")}/>
          <FormInput label="Factura" value={form.invoice} placeholder="Número de factura" onChangeText={v=>updateForm("invoice",v)} />
          <CatalogField label="Cliente" value={form.client} onPress={()=>openSelector("Cliente","client","CLIENT")}/>
          <CatalogField label="Tipo" value={form.service_type} onPress={()=>openSelector("Tipo","service_type","SERVICE_TYPE")}/>
          <CatalogField label="Categoría" value={form.category} onPress={()=>openSelector("Categoría","category","CATEGORY")}/>
          <FormInput label="Contenedor" value={form.container} placeholder="Contenedor" onChangeText={v=>updateForm("container",v)} />
          <FormInput label="Peso" value={form.weight} placeholder="0" keyboardType="decimal-pad" onChangeText={v=>updateForm("weight",v)} />
          <CatalogField label="Destino" value={form.destination} onPress={()=>openSelector("Destino","destination","DESTINATION")}/>

          <Text style={styles.section}>Importes</Text>
          <FormInput label="Flete efectivo Rodrigo" value={form.rodrigo_cash_freight} placeholder="$0.00" keyboardType="decimal-pad" onChangeText={v=>updateForm("rodrigo_cash_freight",v)} onFocus={scrollToBottomField} />
          <FormInput label="Flete factura" value={form.invoice_freight} placeholder="$0.00" keyboardType="decimal-pad" onChangeText={v=>updateForm("invoice_freight",v)} onFocus={scrollToBottomField} />
          <FormInput label="Anticipo efectivo Carlos" value={form.carlos_cash_advance} placeholder="$0.00" keyboardType="decimal-pad" onChangeText={v=>updateForm("carlos_cash_advance",v)} onFocus={scrollToBottomField} />
          <FormInput label="Pago factura Carlos" value={form.carlos_invoice_payment} placeholder="$0.00" keyboardType="decimal-pad" onChangeText={v=>updateForm("carlos_invoice_payment",v)} onFocus={scrollToBottomField} />

          {customFields.length > 0 && <>
            <Text style={styles.section}>Campos adicionales</Text>
            {customFields.map(field => field.field_type === "boolean" ? (
              <View key={field.id} style={styles.booleanRow}><View style={{flex:1}}><Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text></View><Switch value={Boolean(customValues[field.field_key])} onValueChange={v=>updateCustomValue(field.field_key,v)} /></View>
            ) : (
              <FormInput key={field.id} label={`${field.label}${field.required ? " *" : ""}`} value={String(customValues[field.field_key] ?? "")} placeholder={field.field_type === "date" ? "AAAA-MM-DD" : field.label} keyboardType={field.field_type === "number" ? "decimal-pad" : "default"} onChangeText={v=>updateCustomValue(field.field_key,v)} onFocus={scrollToBottomField} />
            ))}
          </>}

          <Text style={styles.section}>Observaciones</Text>
          <TextInput multiline value={form.observations} onChangeText={v=>updateForm("observations",v)} placeholder="Observaciones..." placeholderTextColor="#94a3b8" style={styles.textArea} onFocus={scrollToBottomField}/>
          <Pressable disabled={saving} onPress={()=>setConfirmVisible(true)} style={[styles.saveButton, saving && {opacity:0.6}]}>{saving ? <ActivityIndicator color="#fff"/> : <Text style={styles.saveText}>Guardar cambios</Text>}</Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={()=>setConfirmVisible(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.dialogIconWrap}><Ionicons name="pencil-outline" size={22} color="#2563EB"/></View>
            <Text style={styles.dialogTitle}>Guardar cambios</Text>
            <Text style={styles.dialogMessage}>¿Deseas actualizar este flete con la información capturada?</Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogSecondary} onPress={()=>setConfirmVisible(false)}><Text style={styles.dialogSecondaryText}>Cancelar</Text></Pressable>
              <Pressable style={styles.dialogPrimary} onPress={()=>{setConfirmVisible(false);void performSave();}}><Text style={styles.dialogPrimaryText}>Guardar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={feedbackVisible} transparent animationType="fade" onRequestClose={()=>setFeedbackVisible(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.feedbackCard}>
            <View style={styles.successCircle}><Ionicons name="checkmark" size={28} color="#258044"/></View>
            <Text style={styles.dialogTitle}>{feedbackTitle}</Text>
            <Text style={styles.dialogMessage}>{feedbackMessage}</Text>
            <Pressable style={styles.feedbackButton} onPress={()=>{setFeedbackVisible(false);router.replace(FLETES_ROUTE);}}><Text style={styles.dialogPrimaryText}>Aceptar</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selector.visible} transparent animationType="slide" onRequestClose={closeSelector}>
        <View style={styles.overlay}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{selector.title}</Text><Pressable onPress={closeSelector}><Text style={styles.close}>Cerrar</Text></Pressable></View>
          <ScrollView>{selectorOptions.map(option => <Pressable key={option.id} style={styles.option} onPress={()=>selectOption(option.value)}><Text style={styles.optionText}>{option.label}</Text></Pressable>)}</ScrollView>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

function CatalogField({label,value,onPress}:{label:string;value:string;onPress:()=>void}) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><Pressable onPress={onPress} style={styles.select}><Text style={value ? styles.selectText : styles.placeholder}>{value || "Seleccionar"}</Text><Text style={styles.chevron}>›</Text></Pressable></View>;
}
function FormInput({label,value,placeholder,onChangeText,keyboardType="default",onFocus}:{label:string;value:string;placeholder:string;onChangeText:(value:string)=>void;keyboardType?:"default"|"decimal-pad";onFocus?:()=>void}) {
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><TextInput value={value} placeholder={placeholder} placeholderTextColor="#94a3b8" keyboardType={keyboardType} onChangeText={onChangeText} onFocus={onFocus} style={styles.input}/></View>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F5F5F7"}, loading:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:"#F5F5F7"}, loadingText:{marginTop:12,color:"#6E6E73"},
  container:{padding:20,paddingBottom:140}, back:{marginTop:10,marginBottom:22,color:"#007AFF",fontSize:16}, eyebrow:{color:"#007AFF",fontWeight:"700"},
  title:{marginTop:6,color:"#1D1D1F",fontSize:31,fontWeight:"800"}, subtitle:{marginTop:8,color:"#6E6E73"}, section:{marginTop:30,marginBottom:14,color:"#1D1D1F",fontSize:21,fontWeight:"800"},
  group:{marginBottom:15}, label:{marginBottom:7,color:"#3A3A3C",fontSize:13,fontWeight:"700"}, input:{height:54,borderWidth:1,borderColor:"#D1D1D6",borderRadius:15,paddingHorizontal:16,backgroundColor:"#fff",color:"#1D1D1F",fontSize:16},
  select:{height:54,borderWidth:1,borderColor:"#D1D1D6",borderRadius:15,paddingHorizontal:16,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}, selectText:{color:"#1D1D1F",fontSize:16}, placeholder:{color:"#8E8E93",fontSize:16}, chevron:{color:"#C7C7CC",fontSize:24},
  booleanRow:{minHeight:58,borderWidth:1,borderColor:"#D1D1D6",borderRadius:15,paddingHorizontal:16,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",marginBottom:15},
  textArea:{minHeight:120,borderWidth:1,borderColor:"#D1D1D6",borderRadius:15,backgroundColor:"#fff",padding:16,color:"#1D1D1F",fontSize:16,textAlignVertical:"top"},
  saveButton:{marginTop:28,height:56,borderRadius:15,backgroundColor:"#1D1D1F",alignItems:"center",justifyContent:"center"}, saveText:{color:"#fff",fontSize:16,fontWeight:"800"},
  dialogOverlay:{flex:1,backgroundColor:"rgba(15,23,42,0.30)",alignItems:"center",justifyContent:"center",padding:24},
  dialogCard:{width:"100%",maxWidth:420,borderRadius:24,backgroundColor:"#fff",padding:22,borderWidth:1,borderColor:"#E5E7EB"},
  feedbackCard:{width:"100%",maxWidth:420,borderRadius:24,backgroundColor:"#fff",padding:24,borderWidth:1,borderColor:"#E5E7EB",alignItems:"center"},
  dialogIconWrap:{width:42,height:42,borderRadius:21,backgroundColor:"#EFF6FF",alignItems:"center",justifyContent:"center",marginBottom:16},
  successCircle:{width:52,height:52,borderRadius:26,backgroundColor:"#ECFDF3",borderWidth:1,borderColor:"#A7DDB8",alignItems:"center",justifyContent:"center",marginBottom:16},
  dialogTitle:{color:"#0F172A",fontSize:22,fontWeight:"800",textAlign:"center"},
  dialogMessage:{marginTop:9,color:"#64748B",fontSize:15,lineHeight:21,textAlign:"center"},
  dialogActions:{flexDirection:"row",gap:10,marginTop:22},
  dialogSecondary:{flex:1,height:48,borderRadius:14,borderWidth:1,borderColor:"#CBD5E1",alignItems:"center",justifyContent:"center",backgroundColor:"#fff"},
  dialogSecondaryText:{color:"#475569",fontSize:15,fontWeight:"700"},
  dialogPrimary:{flex:1,height:48,borderRadius:14,backgroundColor:"#0F172A",alignItems:"center",justifyContent:"center"},
  feedbackButton:{alignSelf:"stretch",height:48,marginTop:22,borderRadius:14,backgroundColor:"#0F172A",alignItems:"center",justifyContent:"center"},
  dialogPrimaryText:{color:"#fff",fontSize:15,fontWeight:"800"},
  overlay:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(0,0,0,0.28)"}, sheet:{maxHeight:"75%",backgroundColor:"#fff",borderTopLeftRadius:24,borderTopRightRadius:24,padding:20}, sheetHeader:{flexDirection:"row",justifyContent:"space-between",marginBottom:10}, sheetTitle:{fontSize:21,fontWeight:"800"}, close:{color:"#007AFF",fontWeight:"700"}, option:{minHeight:56,justifyContent:"center",borderBottomWidth:1,borderBottomColor:"#E5E5EA"}, optionText:{color:"#1D1D1F",fontSize:16,fontWeight:"600"},
});
