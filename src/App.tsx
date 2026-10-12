import React, { useEffect, useState } from "react";
import "./styles.css";
import { supabase } from "./supabaseClient";
import AdminLogin from "./AdminLogin";
type Shop = {
  id: string;
  name: string;
  category: string;
  phone: string;
  address: string;
  description: string;
  status: "pending" | "approved" | "rejected";
};

const categories = [
  "مطاعم",
  "سوبر ماركت",
  "أفران",
  "ألبسة",
  "صيانة",
  "خدمات طبية",
  "تعليم",
  "مواصلات",
  "أخرى",
];

const initialShops: Shop[] = [];

const emptyForm = {
  name: "",
  category: "سوبر ماركت",
  phone: "",
  address: "",
  description: "",
};

function loadData<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [shops, setShops] = useState<Shop[]>(() =>
    loadData("karamalak-shops", initialShops)
  );
  const [requests, setRequests] = useState<Shop[]>(() =>
    loadData("karamalak-requests", [])
  );
  const [page, setPage] = useState("home");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdminLoggedIn(!!session);
    });
  
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminLoggedIn(!!session);
    });
  
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("karamalak-shops", JSON.stringify(shops));
  }, [shops]);
  useEffect(() => {
    async function loadShopsFromSupabase() {
      const { data, error } = await supabase
        .from("shops")
        .select("*")
        .eq("is_active", true);
  
      if (error) {
        console.error("خطأ في تحميل المحلات:", error.message);
        setMessage("تعذّر تحميل المحلات من قاعدة البيانات.");
        return;
      }
  
      if (data) {
        const formattedShops: Shop[] = data.map((shop) => ({
          id: String(shop.id),
          name: shop.name ?? "",
          category: shop.category ?? "أخرى",
          phone: shop.phone ?? "",
          address: shop.address ?? "",
          description: shop.description ?? "",
          status: "approved",
        }));
  
        setShops(formattedShops);
      }
    }
  
    loadShopsFromSupabase();
  }, []);
  useEffect(() => {
    if (!isAdminLoggedIn) return;
  
    async function loadRequestsFromSupabase() {
      const { data, error } = await supabase
        .from("shop_requests")
        .select("*")
        .order("created_at", { ascending: false });
  
      if (error) {
        console.error("خطأ في تحميل طلبات الانضمام:", error.message);
        setMessage(`تعذّر تحميل الطلبات: ${error.message}`);
        return;
      }
  
      if (data) {
        const formattedRequests: Shop[] = data.map((request) => ({
          id: String(request.id),
          name: request.name ?? "",
          category: request.category ?? "أخرى",
          phone: request.phone ?? "",
          address: request.address ?? "",
          description: request.description ?? "",
          status: request.status as Shop["status"],
        }));
  
        setRequests(formattedRequests);
      }
    }
  
    loadRequestsFromSupabase();
  }, [isAdminLoggedIn]);
  
  useEffect(() => {
    localStorage.setItem("karamalak-requests", JSON.stringify(requests));
  }, [requests]);

  const approvedShops = shops.filter((shop) => shop.status === "approved");

  const visibleShops = approvedShops.filter((shop) => {
    const term = search.trim().toLowerCase();

    return (
      (category === "الكل" || shop.category === category) &&
      (!term ||
        shop.name.toLowerCase().includes(term) ||
        shop.category.toLowerCase().includes(term) ||
        shop.address.toLowerCase().includes(term) ||
        shop.description.toLowerCase().includes(term))
    );
  });

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  
async function submitRequest(e: React.FormEvent) {
  e.preventDefault();

  const { error } = await supabase
    .from("shop_requests")
    .insert({
      name: form.name,
      category: form.category,
      phone: form.phone,
      address: form.address,
      description: form.description,
      status: "pending",
    });

  if (error) {
    console.error("خطأ في إرسال طلب الانضمام:", error.message);
    setMessage(`تعذّر إرسال الطلب: ${error.message}`);
    return;
  }

  setForm(emptyForm);
  setShowRequestForm(false);
  setMessage("تم إرسال طلب الانضمام وحفظه بنجاح.");
}



async function approveRequest(id: string) {
  const request = requests.find(
    (item) => item.id === id && item.status === "pending"
  );

  if (!request) return;

  const { data: newShop, error: insertError } = await supabase
    .from("shops")
    .insert({
      name: request.name,
      category: request.category,
      phone: request.phone,
      address: request.address,
      description: request.description,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) {
    console.error("خطأ في نشر المحل:", insertError.message);
    setMessage(`تعذّر نشر المحل: ${insertError.message}`);
    return;
  }

  const { error: updateError } = await supabase
    .from("shop_requests")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "pending");

  if (updateError) {
    console.error("خطأ في تحديث الطلب:", updateError.message);
    setMessage(
      "أُضيف المحل، لكن تعذّر تحديث حالة الطلب. راجع قاعدة البيانات قبل إعادة المحاولة."
    );
    return;
  }

  const formattedShop: Shop = {
    id: String(newShop.id),
    name: newShop.name ?? "",
    category: newShop.category ?? "أخرى",
    phone: newShop.phone ?? "",
    address: newShop.address ?? "",
    description: newShop.description ?? "",
    status: "approved",
  };

  setShops((current) => [formattedShop, ...current]);
  setRequests((current) =>
    current.map((item) =>
      item.id === id ? { ...item, status: "approved" } : item
    )
  );

  setMessage("تمت الموافقة على الطلب ونشر المحل.");
}

async function rejectRequest(id: string) {
  const { error } = await supabase
    .from("shop_requests")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("خطأ في رفض الطلب:", error.message);
    setMessage(`تعذّر رفض الطلب: ${error.message}`);
    return;
  }

  setRequests((current) =>
    current.map((item) =>
      item.id === id ? { ...item, status: "rejected" } : item
    )
  );

  setMessage("تم رفض الطلب وحفظ الحالة في قاعدة البيانات.");
}

 

async function saveShop(e: React.FormEvent) {
  e.preventDefault();

  if (editing) {
    const { data, error } = await supabase
      .from("shops")
      .update({
        name: form.name,
        category: form.category,
        phone: form.phone,
        address: form.address,
        description: form.description,
      })
      .eq("id", editing)
      .select()
      .single();

    if (error) {
      console.error("خطأ في تعديل المحل:", error.message);
      setMessage(`فشل الحفظ: ${error.message}`);
      return;
    }

    if (data) {
      const updatedShop: Shop = {
        id: String(data.id),
        name: data.name ?? "",
        category: data.category ?? "أخرى",
        phone: data.phone ?? "",
        address: data.address ?? "",
        description: data.description ?? "",
        status: "approved",
      };

      setShops((current) =>
        current.map((shop) =>
          shop.id === updatedShop.id ? updatedShop : shop
        )
      );

      setMessage("تم حفظ التعديلات بنجاح.");
    }
  } else {
    const { data, error } = await supabase
      .from("shops")
      .insert({
        name: form.name,
        category: form.category,
        phone: form.phone,
        address: form.address,
        description: form.description,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("خطأ في إضافة المحل:", error.message);
      setMessage(`فشل الحفظ: ${error.message}`);
      return;
    }

    if (data) {
      const newShop: Shop = {
        id: String(data.id),
        name: data.name ?? "",
        category: data.category ?? "أخرى",
        phone: data.phone ?? "",
        address: data.address ?? "",
        description: data.description ?? "",
        status: "approved",
      };

      setShops((current) => [newShop, ...current]);
      setMessage("تمت إضافة المحل بنجاح.");
    }
  }

  setForm(emptyForm);
  setEditing(null);
}


 
async function deleteShop(id: string) {
  if (!window.confirm("هل تريد حذف هذا المحل نهائياً؟")) {
    return;
  }

  const { data, error } = await supabase
    .from("shops")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    console.error("خطأ في حذف المحل:", error.message);
    setMessage(`تعذّر حذف المحل: ${error.message}`);
    return;
  }

  if (data) {
    setShops((current) =>
      current.filter((shop) => shop.id !== String(data.id))
    );

    setMessage("تم حذف المحل من قاعدة البيانات بنجاح.");
  }
}

  function openAdmin() {
    setPage("admin");
  
    if (!isAdminLoggedIn) {
      setMessage("يرجى تسجيل الدخول للوصول إلى لوحة الإدارة.");
    } else {
      setMessage("");
    }
  }

  return (
    <div className="app" dir="rtl">
      <header className="topbar">
      <button className="brand" onClick={() => setPage("home")}>
  <img
    src="/karmalak-logo.png" 
    alt="شعار كرمالك"
    className="brand-logo"
  />
  <span>كرمالك</span>
</button>
        <div className="location-tag">📍 مخيم الوافدين</div>
      </header>

      <main className="main-content">
        {message && (
          <div className="notice-bar">
            <span>{message}</span>
            <button onClick={() => setMessage("")}>✕</button>
          </div>
        )}

        {page === "home" && (
          <>
            <section className="hero">
              <span className="hero-badge">دليلك المحلي في مخيم الوافدين</span>
              <h1>كل خدمات منطقتك، بمكان واحد</h1>
              <p>اكتشف المحلات والخدمات المعتمدة القريبة منك.</p>
              <div className="search-box">
                <span>🔎</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن محل أو خدمة أو عنوان..."
                />
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>تصفّح الأقسام</h2>
                  <p>اختر الخدمة التي تحتاجها</p>
                </div>
              </div>

              <div className="category-list">
                {["الكل", ...categories].map((item) => (
                  <button
                    key={item}
                    className={
                      category === item
                        ? "category-chip active"
                        : "category-chip"
                    }
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-heading">
                <div>
                  <h2>المحلات المعتمدة</h2>
                  <p>{visibleShops.length} محل متاح في الدليل</p>
                </div>
              </div>

              {visibleShops.length ? (
                <div className="service-grid">
                  {visibleShops.map((shop) => (
                    <article className="service-card" key={shop.id}>
                      <div className="shop-category">{shop.category}</div>
                      <h3>{shop.name}</h3>
                      <p>{shop.description}</p>
                      <div className="shop-detail">📍 {shop.address}</div>
                      {shop.phone && (
                        <a
                          className="contact-button"
                          href={`tel:${shop.phone}`}
                        >
                          ☎ اتصال بالمحل
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🏪</div>
                  <h3>لا توجد محلات معتمدة هنا بعد</h3>
                  <p>يمكنك اقتراح محل ليتم مراجعته قبل نشره.</p>
                  <button
                    className="primary-button"
                    onClick={() => {
                      setShowRequestForm(true);
                      setPage("request");
                    }}
                  >
                    طلب انضمام محل
                  </button>
                </div>
              )}
            </section>

            <section className="join-banner">
              <div>
                <h2>عندك محل بمخيم الوافدين؟</h2>
                <p>قدّم طلب انضمام، وبعد المراجعة يمكن نشر محلك ضمن الدليل.</p>
              </div>
              <button
                className="join-button"
                onClick={() => {
                  setForm(emptyForm);
                  setPage("request");
                }}
              >
                قدّم طلبك ←
              </button>
            </section>
          </>
        )}

        {page === "request" && (
          <section className="form-panel">
            <button className="back-button" onClick={() => setPage("home")}>
              ← العودة إلى الرئيسية
            </button>
            <h1>طلب انضمام محل</h1>
            <p className="muted">
              املأ المعلومات التالية. لن يظهر المحل للعامة قبل موافقة الإدارة.
            </p>
            <ShopForm
              form={form}
              updateForm={updateForm}
              onSubmit={submitRequest}
              submitLabel="إرسال طلب الانضمام"
            />
          </section>
        )}

{page === "admin" && !isAdminLoggedIn && (
  <AdminLogin onLogin={() => setIsAdminLoggedIn(true)} />
)}

{page === "admin" && isAdminLoggedIn && (
          <section className="admin-panel">
            <div className="admin-heading">
              <div>
                <span className="admin-label">لوحة الإدارة</span>
                <h1>إدارة كرمالك</h1>
         6       <p className="muted">إدارة المحلات وطلبات الانضمام.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setPage("home")}
              >
                عرض الموقع
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>المحلات المعتمدة</span>
                <strong>{approvedShops.length}</strong>
              </div>
              <div className="stat-card">
                <span>طلبات قيد المراجعة</span>
                <strong>
                  {requests.filter((r) => r.status === "pending").length}
                </strong>
              </div>
              <div className="stat-card">
                <span>الطلبات المرفوضة</span>
                <strong>
                  {requests.filter((r) => r.status === "rejected").length}
                </strong>
              </div>
            </div>

            <div className="admin-section">
              <h2>{editing ? "تعديل بيانات محل" : "إضافة محل مباشرة"}</h2>
              <p className="muted">
                الإضافة المباشرة مخصصة للإدارة. تأكد من صحة البيانات.
              </p>
              <ShopForm
                form={form}
                updateForm={updateForm}
                onSubmit={saveShop}
                submitLabel={editing ? "حفظ التعديلات" : "إضافة المحل"}
              />
              {editing && (
                <button
                  className="secondary-button cancel-edit"
                  onClick={() => {
                    setEditing(null);
                    setForm(emptyForm);
                  }}
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <div className="admin-section">
              <h2>طلبات الانضمام</h2>
              {requests.filter((r) => r.status === "pending").length === 0 ? (
                <p className="muted">لا توجد طلبات جديدة.</p>
              ) : (
                requests
                  .filter((r) => r.status === "pending")
                  .map((shop) => (
                    <div className="admin-shop" key={shop.id}>
                      <div>
                        <h3>{shop.name}</h3>
                        <p>
                          {shop.category} · {shop.address}
                        </p>
                        <p>{shop.phone}</p>
                        <p>{shop.description}</p>
                      </div>
                      <div className="admin-actions">
                        <button
                          className="approve-button"
                          onClick={() => approveRequest(shop.id)}
                        >
                          موافقة ونشر
                        </button>
                        <button
                          className="reject-button"
                          onClick={() => rejectRequest(shop.id)}
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  ))
              )}

              {requests.some((r) => r.status === "rejected") && (
                <details className="rejected-list">
                  <summary>عرض الطلبات المرفوضة</summary>
                  {requests
                    .filter((r) => r.status === "rejected")
                    .map((r) => (
                      <p key={r.id}>
                        {r.name} — {r.category}
                        <button
                          className="text-button"
                          onClick={() =>
                            setRequests((current) =>
                              current.filter((item) => item.id !== r.id)
                            )
                          }
                        >
                          حذف
                        </button>
                      </p>
                    ))}
                </details>
              )}
            </div>

            <div className="admin-section">
              <h2>المحلات المنشورة</h2>
              {approvedShops.length === 0 ? (
                <p className="muted">لم تتم إضافة محلات بعد.</p>
              ) : (
                approvedShops.map((shop) => (
                  <div className="admin-shop" key={shop.id}>
                    <div>
                      <h3>{shop.name}</h3>
                      <p>
                        {shop.category} · {shop.address}
                      </p>
                      <span className="approved-label">معتمد ومنشور</span>
                    </div>
                    <div className="admin-actions">
                      <button
                        className="secondary-button"
                        onClick={() => editShop(shop)}
                      >
                        تعديل
                      </button>
                      <button
                        className="reject-button"
                        onClick={() => deleteShop(shop.id)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        <button
          className={page === "home" ? "nav-item selected" : "nav-item"}
          onClick={() => setPage("home")}
        >
          <span>🏠</span> الرئيسية
        </button>
        <button
          className={page === "request" ? "nav-item selected" : "nav-item"}
          onClick={() => {
            setForm(emptyForm);
            setPage("request");
          }}
        >
          <span>➕</span> انضم إلينا
        </button>
        <button
          className={page === "admin" ? "nav-item selected" : "nav-item"}
          onClick={openAdmin}
        >
          <span>⚙️</span> الإدارة
        </button>
      </footer>
    </div>
  );
}

type ShopFormProps = {
  form: typeof emptyForm;
  updateForm: (field: keyof typeof emptyForm, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel: string;
};

function ShopForm({ form, updateForm, onSubmit, submitLabel }: ShopFormProps) {
  return (
    <form className="shop-form" onSubmit={onSubmit}>
      <label>
        اسم المحل *
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => updateForm("name", e.target.value)}
          placeholder="مثال: سوبر ماركت..."
        />
      </label>

      <label>
        القسم *
        <select
          value={form.category}
          onChange={(e) => updateForm("category", e.target.value)}
        >
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label>
        رقم الهاتف
        <input
          type="tel"
          maxLength={30}
          value={form.phone}
          onChange={(e) => updateForm("phone", e.target.value)}
          placeholder="رقم التواصل"
        />
      </label>

      <label>
        العنوان داخل مخيم الوافدين *
        <input
          required
          maxLength={200}
          value={form.address}
          onChange={(e) => updateForm("address", e.target.value)}
          placeholder="الشارع أو المنطقة أو أقرب معلم"
        />
      </label>

      <label>
        وصف الخدمات *
        <textarea
          required
          maxLength={1000}
          rows={4}
          value={form.description}
          onChange={(e) => updateForm("description", e.target.value)}
          placeholder="ما الخدمات التي يقدمها المحل؟"
        />
      </label>

      <button className="primary-button" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
