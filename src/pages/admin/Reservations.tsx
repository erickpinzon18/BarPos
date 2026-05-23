import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import type { Reservation, ReservationStatus, ReservationPriority, Table } from "../../utils/types";
import {
  CalendarDays,
  Plus,
  Users,
  Edit2,
  Trash2,
  Clock,
  X,
  AlignLeft,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PartyPopper,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

const statusColors: Record<ReservationStatus, string> = {
  pendiente: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  aceptada: "text-green-400 bg-green-500/10 border-green-500/20",
  cancelada: "text-red-400 bg-red-500/10 border-red-500/20",
  "llegó": "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const statusLabels: Record<ReservationStatus, string> = {
  pendiente: "Pendiente",
  aceptada: "Aceptada",
  cancelada: "Cancelada",
  "llegó": "Llegó ✓",
};

const priorityColors: Record<ReservationPriority, string> = {
  baja: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  media: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  alta: "text-red-400 bg-red-500/10 border-red-500/20",
};

const priorityLabels: Record<ReservationPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

const Reservations: React.FC = () => {
  const { currentUser } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<"todos" | "hoy" | "mañana" | "semana">("todos");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [customerName, setCustomerName] = useState("");
  const [pax, setPax] = useState<string>("2");
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [status, setStatus] = useState<ReservationStatus>("pendiente");
  const [priority, setPriority] = useState<ReservationPriority>("media");
  const [notes, setNotes] = useState("");
  const [tableId, setTableId] = useState("");

  useEffect(() => {
    // Listen to Tables in real-time so occupied status updates live
    const unsubTables = onSnapshot(
      query(collection(db, "tables")),
      (snapshot) => {
        const loadedTables = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Table)
        );
        loadedTables.sort((a, b) => {
          const na = Number(a.number), nb = Number(b.number);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return String(a.number).localeCompare(String(b.number));
        });
        setTables(loadedTables);
      },
      (error) => console.error("Error loading tables:", error)
    );

    // Listen to Reservations
    const qReservations = query(
      collection(db, "reservations"),
      orderBy("reservationDate", "desc")
    );

    const unsubscribe = onSnapshot(
      qReservations,
      (snapshot) => {
        const loadedReservations: Reservation[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loadedReservations.push({
            id: doc.id,
            ...data,
            reservationDate: data.reservationDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as Reservation);
        });
        setReservations(loadedReservations);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching reservations:", error);
        toast.error("Error al cargar reservaciones");
        setLoading(false);
      }
    );

    return () => {
      unsubTables();
      unsubscribe();
    };
  }, []);

  const resetForm = () => {
    setCustomerName("");
    setPax("2");

    // Set default date to today, default time to 19:00
    const now = new Date();
    setReservationDate(now.toISOString().split('T')[0]);
    setReservationTime("19:00");

    setStatus("pendiente");
    setPriority("media");
    setNotes("");
    setTableId("");
    setEditingId(null);
  };

  const handleOpenModal = (res?: Reservation) => {
    if (res) {
      setEditingId(res.id);
      setCustomerName(res.customerName);
      setPax(String(res.pax));

      const dateObj = new Date(res.reservationDate);
      // Format to YYYY-MM-DD
      const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
      setReservationDate(localDate.toISOString().split('T')[0]);

      // Format to HH:MM
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      setReservationTime(`${hours}:${minutes}`);

      setStatus(res.status);
      setPriority(res.priority);
      setNotes(res.notes || "");
      setTableId(res.tableId || "");
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !reservationDate || !reservationTime || !pax || parseInt(pax) < 1) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    try {
      // Combine date and time
      const dateTimeString = `${reservationDate}T${reservationTime}:00`;
      const finalReservationDate = new Date(dateTimeString);

      const table = tables.find(t => t.id === tableId);

      const reservationData = {
        customerName,
        pax: parseInt(pax) || 1,
        reservationDate: Timestamp.fromDate(finalReservationDate),
        status,
        priority,
        notes,
        tableId: tableId || null,
        tableName: table ? `Mesa ${table.number}` : null,
        updatedAt: Timestamp.now(),
      };

      if (editingId) {
        // Update existing
        await updateDoc(doc(db, "reservations", editingId), reservationData);
        toast.success("Reservación actualizada");
      } else {
        // Create new
        await addDoc(collection(db, "reservations"), {
          ...reservationData,
          createdBy: currentUser?.id || "unknown",
          createdByName: currentUser?.displayName || "Admin",
          createdAt: Timestamp.now(),
        });
        toast.success("Reservación creada");
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving reservation:", error);
      toast.error("Error al guardar la reservación");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar esta reservación?")) {
      try {
        await deleteDoc(doc(db, "reservations", id));
        toast.success("Reservación eliminada");
      } catch (error) {
        console.error("Error deleting reservation:", error);
        toast.error("Error al eliminar");
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: ReservationStatus) => {
    try {
      await updateDoc(doc(db, "reservations", id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      toast.success(`Estado actualizado a ${statusLabels[newStatus]}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Error al actualizar estado");
    }
  };

  const stats = React.useMemo(() => {
    let today = 0;
    let tomorrow = 0;
    let upcoming = 0;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const dayAfterTomorrowStart = new Date(todayStart);
    dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 2);

    reservations.forEach(res => {
      if (res.status === 'cancelada' || res.status === 'llegó') return;
      
      const resDate = new Date(res.reservationDate);
      if (resDate >= todayStart && resDate < tomorrowStart) {
        today += res.pax;
      } else if (resDate >= tomorrowStart && resDate < dayAfterTomorrowStart) {
        tomorrow += res.pax;
      } else if (resDate >= dayAfterTomorrowStart) {
        upcoming += res.pax;
      }
    });

    return { today, tomorrow, upcoming };
  }, [reservations]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="text-red-500" />
            Reservaciones
          </h1>
          <p className="text-gray-400 mt-1">
            Gestiona las reservaciones de clientes y mesas
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg"
        >
          <Plus size={20} />
          Nueva Reservación
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-red-500/20 p-3 rounded-lg text-red-500">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Hoy</p>
            <p className="text-2xl font-bold text-white">
              {stats.today} <span className="text-sm font-normal text-gray-500">personas</span>
            </p>
          </div>
        </div>
        
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-orange-500/20 p-3 rounded-lg text-orange-500">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Mañana</p>
            <p className="text-2xl font-bold text-white">
              {stats.tomorrow} <span className="text-sm font-normal text-gray-500">personas</span>
            </p>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-blue-500/20 p-3 rounded-lg text-blue-500">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Próximos días</p>
            <p className="text-2xl font-bold text-white">
              {stats.upcoming} <span className="text-sm font-normal text-gray-500">personas</span>
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente o mesa..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(["todos", "hoy", "mañana", "semana"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDayFilter(d)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                dayFilter === d
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700"
              }`}
            >
              {d === "todos" ? "Todos" : d === "hoy" ? "Hoy" : d === "mañana" ? "Mañana" : "Esta semana"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-12 text-center">
          <CalendarDays className="mx-auto h-16 w-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            No hay reservaciones
          </h3>
          <p className="text-gray-400">
            Aún no tienes reservaciones registradas en el sistema.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-6 text-red-500 hover:text-red-400 font-medium"
          >
            + Crear tu primera reservación
          </button>
        </div>
      ) : (() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart.getTime() + 86400000);
        const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

        const q = search.trim().toLowerCase();

        const matchesSearch = (r: Reservation) => {
          if (!q) return true;
          return (
            r.customerName.toLowerCase().includes(q) ||
            (r.tableName ?? "").toLowerCase().includes(q)
          );
        };

        const matchesDay = (r: Reservation) => {
          const d = new Date(r.reservationDate);
          if (dayFilter === "hoy") return d >= todayStart && d < tomorrowStart;
          if (dayFilter === "mañana") return d >= tomorrowStart && d < new Date(tomorrowStart.getTime() + 86400000);
          if (dayFilter === "semana") return d >= todayStart && d < weekEnd;
          return true;
        };

        const sortByDateTodayFirst = (a: Reservation, b: Reservation) => {
          const aDate = new Date(a.reservationDate);
          const bDate = new Date(b.reservationDate);
          const aIsToday = aDate >= todayStart && aDate < tomorrowStart;
          const bIsToday = bDate >= todayStart && bDate < tomorrowStart;
          if (aIsToday && !bIsToday) return -1;
          if (!aIsToday && bIsToday) return 1;
          return aDate.getTime() - bDate.getTime();
        };

        const activeReservations = reservations
          .filter(r => r.status !== 'llegó' && r.status !== 'cancelada')
          .filter(matchesSearch)
          .filter(matchesDay)
          .sort(sortByDateTodayFirst);

        const archivedReservations = reservations
          .filter(r => r.status === 'llegó' || r.status === 'cancelada')
          .filter(matchesSearch)
          .sort((a, b) => new Date(b.reservationDate).getTime() - new Date(a.reservationDate).getTime());

        const ReservationCard = ({ res, archived = false }: { res: Reservation; archived?: boolean }) => {
          const assignedTable = res.tableId ? tables.find(t => t.id === res.tableId) : null;
          const tableOccupied = assignedTable?.status === 'ocupada';
          const resDate = new Date(res.reservationDate);
          const isToday = resDate >= todayStart && resDate < tomorrowStart;

          return (
          <div
            key={res.id}
            className={`border rounded-xl p-5 transition-colors relative group ${
              archived
                ? 'bg-gray-800/40 border-gray-700/50 opacity-70'
                : tableOccupied
                  ? 'bg-green-950/30 border-green-600/60 hover:border-green-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
            }`}
          >
            {/* "Ya llegaron" banner */}
            {tableOccupied && !archived && (
              <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-lg px-3 py-2 mb-3">
                <span className="text-lg">🍽️</span>
                <div>
                  <p className="text-green-400 text-xs font-bold uppercase tracking-wide">¡Ya están en mesa!</p>
                  <p className="text-green-300/70 text-xs">La mesa está ocupada y ya pidieron</p>
                </div>
              </div>
            )}

            {/* Header: Name and Actions */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 pr-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-white line-clamp-1">{res.customerName}</h3>
                  {isToday && !archived && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wide flex-shrink-0">HOY</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {!archived && (
                  <>
                    <button
                      onClick={() => handleOpenModal(res)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmArchiveId(res.id)}
                      className="p-1.5 bg-gray-700 hover:bg-purple-900/40 rounded text-gray-300 hover:text-purple-400 transition-colors"
                      title="Marcar como Llegó (archivar)"
                    >
                      <PartyPopper size={16} />
                    </button>
                  </>
                )}
                {archived && (
                  <button
                    onClick={() => handleStatusChange(res.id, 'pendiente')}
                    className="p-1.5 bg-gray-700 hover:bg-blue-900/40 rounded text-gray-300 hover:text-blue-400 transition-colors"
                    title="Desarchivar (volver a pendiente)"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(res.id)}
                  className="p-1.5 bg-gray-700 hover:bg-red-900/30 rounded text-gray-300 hover:text-red-500 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Status & Priority Badges */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${statusColors[res.status]}`}>
                {statusLabels[res.status]}
              </span>
              {!archived && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${priorityColors[res.priority]} flex items-center gap-1`}>
                  <AlertCircle size={12} />
                  {priorityLabels[res.priority]}
                </span>
              )}
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-500" />
                <span>{res.reservationDate.toLocaleDateString("es-ES", { day: 'numeric', month: 'short' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-500" />
                <span>{res.reservationDate.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-500" />
                <span>{res.pax} Personas</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-500" />
                <span>{res.tableName || "Mesa sin asignar"}</span>
              </div>
            </div>

            {/* Notes */}
            {res.notes && (
              <div className="mb-4 bg-gray-900/50 p-3 rounded-lg text-sm text-gray-400 flex items-start gap-2">
                <AlignLeft size={16} className="mt-0.5 flex-shrink-0" />
                <p className="line-clamp-2">{res.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700 text-xs text-gray-500">
              <span>Por: {res.createdByName}</span>

              {!archived && (
                <div className="flex items-center gap-1">
                  {res.status !== 'aceptada' && (
                    <button
                      onClick={() => handleStatusChange(res.id, 'aceptada')}
                      className="p-1 hover:text-green-400 hover:bg-green-400/10 rounded transition-colors"
                      title="Marcar como Aceptada"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {res.status !== 'cancelada' && (
                    <button
                      onClick={() => handleStatusChange(res.id, 'cancelada')}
                      className="p-1 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      title="Marcar como Cancelada"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          );
        };

        return (
          <div className="space-y-8">
            {/* Active reservations */}
            {activeReservations.length === 0 ? (
              <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-12 text-center">
                <CalendarDays className="mx-auto h-16 w-16 text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">
                  {search || dayFilter !== "todos" ? "Sin resultados" : "No hay reservaciones activas"}
                </h3>
                <p className="text-gray-400">
                  {search
                    ? `No se encontraron reservaciones para "${search}".`
                    : dayFilter !== "todos"
                      ? "No hay reservaciones para el período seleccionado."
                      : "Todas las reservaciones han sido atendidas o canceladas."}
                </p>
                {(search || dayFilter !== "todos") ? (
                  <button
                    onClick={() => { setSearch(""); setDayFilter("todos"); }}
                    className="mt-6 text-red-500 hover:text-red-400 font-medium"
                  >
                    Limpiar filtros
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenModal()}
                    className="mt-6 text-red-500 hover:text-red-400 font-medium"
                  >
                    + Crear nueva reservación
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeReservations.map((res) => (
                  <ReservationCard key={res.id} res={res} />
                ))}
              </div>
            )}

            {/* Archived section */}
            {archivedReservations.length > 0 && (
              <div>
                <button
                  onClick={() => setShowArchived(v => !v)}
                  className="flex items-center gap-2 text-gray-400 hover:text-gray-300 text-sm font-medium mb-4 transition-colors"
                >
                  {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Archivo ({archivedReservations.length} reservación{archivedReservations.length !== 1 ? 'es' : ''})
                </button>

                {showArchived && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archivedReservations.map((res) => (
                      <ReservationCard key={res.id} res={res} archived />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? "Editar Reservación" : "Nueva Reservación"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Cliente & Pax */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Personas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 text-center"
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={reservationDate}
                    onChange={(e) => setReservationDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Hora *
                  </label>
                  <input
                    type="time"
                    required
                    value={reservationTime}
                    onChange={(e) => setReservationTime(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Estado
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ReservationStatus)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="cancelada">Cancelada</option>
                    <option value="llegó">Llegó ✓</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ReservationPriority)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>

              {/* Table Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Asignar Mesa (Opcional)
                </label>
                <select
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="">Sin asignar</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Mesa {t.number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Notas / Preferencias
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 resize-none"
                  placeholder="Ej. Celebración de cumpleaños, requiere silla para bebé..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium shadow-lg"
                >
                  {editingId ? "Guardar Cambios" : "Crear Reservación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Archive Modal */}
      {confirmArchiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl w-full max-w-sm shadow-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-500/20 p-2 rounded-lg">
                <PartyPopper size={20} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white">¿Marcar como llegó?</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              La reservación se archivará con el estado <span className="text-purple-400 font-semibold">Llegó ✓</span>. Podrás verla y desarchivarla en cualquier momento.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await handleStatusChange(confirmArchiveId, 'llegó');
                  setConfirmArchiveId(null);
                }}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                Sí, archivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;
