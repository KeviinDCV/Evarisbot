import AdminLayout from '@/layouts/admin-layout';
import { Head, useForm } from '@inertiajs/react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormEventHandler, useState, useMemo } from 'react';

interface Appointment {
    id: number;
    citead?: string;
    cianom?: string;
    citmed?: string;
    mednom?: string;
    citesp?: string;
    espnom?: string;
    citfc?: string;
    cithor?: string;
    citdoc?: string;
    nom_paciente?: string;
    pactel?: string;
    pacnac?: string;
    pachis?: string;
    cittid?: string;
    citide?: string;
    citres?: string;
    cittip?: string;
    nom_cotizante?: string;
    citcon?: string;
    connom?: string;
    citurg?: string;
    citobsobs?: string;
    duracion?: string;
    ageperdes_g?: string;
    dia?: string;
}

interface AppointmentIndexProps {
    appointments: Appointment[];
    totalAppointments?: number;
    uploadedFile?: {
        name: string;
        path: string;
        size: number;
        uploaded_at: string;
        total_rows?: number;
    };
}

export default function AppointmentsIndex({ appointments: initialAppointments, totalAppointments = 0, uploadedFile }: AppointmentIndexProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    
    const { data, setData, post, processing, errors, reset } = useForm({
        file: null as File | null,
    });

    // Filtrar citas por búsqueda
    const filteredAppointments = useMemo(() => {
        if (!searchTerm.trim()) return initialAppointments;
        
        const search = searchTerm.toLowerCase();
        return initialAppointments.filter(apt => 
            apt.nom_paciente?.toLowerCase().includes(search) ||
            apt.pactel?.toLowerCase().includes(search) ||
            apt.mednom?.toLowerCase().includes(search) ||
            apt.espnom?.toLowerCase().includes(search) ||
            apt.citdoc?.toLowerCase().includes(search)
        );
    }, [initialAppointments, searchTerm]);

    // Paginación
    const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
    const paginatedAppointments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAppointments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAppointments, currentPage]);

    // Reset página cuando cambia la búsqueda
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setData('file', e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setData('file', e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/admin/appointments/upload', {
            onSuccess: () => reset('file'),
        });
    };

    const removeFile = () => {
        setData('file', null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <AdminLayout>
            <Head title="Citas" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">
                            Gestión de Citas
                        </h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">
                            Carga un archivo Excel con las citas programadas para enviar recordatorios automáticos
                        </p>
                    </div>

                    {/* Upload Section */}
                    <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6"
                    >
                    <form onSubmit={submit}>
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold text-[#2e3f84] mb-4 flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5" />
                                Cargar Archivo de Citas
                            </h2>

                            {/* File Upload Area */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`
                                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                    bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9]
                                    ${isDragging ? 'border-[#2e3f84] from-white to-[#fafbfc]' : 'border-[#d4d8e8]'}
                                    hover:border-[#2e3f84] hover:from-white hover:to-[#fafbfc]
                                    transition-all duration-200
                                    shadow-[inset_0_1px_2px_rgba(46,63,132,0.05)]
                                `}
                            >
                                {!data.file ? (
                                    <label className="cursor-pointer block">
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileChange}
                                            disabled={processing}
                                        />
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_8px_rgba(46,63,132,0.2),inset_0_1px_0_rgba(255,255,255,0.15)]">
                                                <Upload className="w-8 h-8 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-lg font-medium text-[#2e3f84] mb-1">
                                                    Arrastra y suelta tu archivo aquí
                                                </p>
                                                <p className="text-sm text-[#6b7494]">
                                                    o <span className="text-[#2e3f84] font-semibold">haz click para seleccionar</span>
                                                </p>
                                                <p className="text-xs text-[#8891b3] mt-2">
                                                    Formatos soportados: .xlsx, .xls, .csv (máx. 10MB)
                                                </p>
                                            </div>
                                        </div>
                                    </label>
                                ) : (
                                    <div className="flex items-center justify-between p-4 bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_6px_rgba(46,63,132,0.15),inset_0_1px_0_rgba(255,255,255,0.15)]">
                                                <FileSpreadsheet className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium text-[#2e3f84]">{data.file.name}</p>
                                                <p className="text-sm text-[#6b7494]">
                                                    {formatFileSize(data.file.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={removeFile}
                                            className="p-2 hover:bg-gradient-to-b hover:from-red-50 hover:to-red-100 rounded-lg transition-all duration-200"
                                            disabled={processing}
                                        >
                                            <X className="w-5 h-5 text-red-500" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {errors.file && (
                                <div className="mt-4 flex items-start gap-2 p-4 bg-gradient-to-b from-red-50 to-red-100/50 rounded-xl shadow-[0_1px_2px_rgba(239,68,68,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]">
                                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-600">{errors.file}</p>
                                </div>
                            )}
                        </div>

                        {/* Upload Button */}
                        {data.file && (
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-6 py-3 text-white rounded-xl font-medium bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_4px_rgba(46,63,132,0.15),0_4px_12px_rgba(46,63,132,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.2),0_6px_16px_rgba(46,63,132,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                >
                                    {processing ? 'Subiendo...' : 'Subir Archivo'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                {/* Uploaded File Info */}
                {uploadedFile && (
                    <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]">
                                <CheckCircle2 className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-[#2e3f84] mb-2">
                                    Archivo Cargado Exitosamente
                                </h3>
                                <div className="space-y-1 text-sm text-[#6b7494]">
                                    <p><span className="font-semibold text-[#2e3f84]">Nombre:</span> {uploadedFile.name}</p>
                                    <p><span className="font-semibold text-[#2e3f84]">Tamaño:</span> {formatFileSize(uploadedFile.size)}</p>
                                    <p><span className="font-semibold text-[#2e3f84]">Registros:</span> {uploadedFile.total_rows || initialAppointments.length} citas</p>
                                    <p><span className="font-semibold text-[#2e3f84]">Fecha:</span> {new Date(uploadedFile.uploaded_at).toLocaleString('es-CO')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabla de Citas */}
                {initialAppointments.length > 0 && (
                    <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6">
                        {/* Header con búsqueda */}
                        <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold text-[#2e3f84]">
                                    Citas en Base de Datos ({totalAppointments})
                                </h2>
                                <p className="text-sm text-[#6b7494]">
                                    Mostrando últimas {initialAppointments.length} citas (filtradas: {filteredAppointments.length})
                                </p>
                            </div>
                            
                            {/* Buscador */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7494]" />
                                <input
                                    type="text"
                                    placeholder="Buscar por paciente, teléfono, médico..."
                                    value={searchTerm}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="pl-10 pr-4 py-2 rounded-xl border border-[#d4d8e8] focus:border-[#2e3f84] focus:ring-2 focus:ring-[#2e3f84]/10 outline-none transition-all duration-200 w-full md:w-80 text-sm"
                                />
                            </div>
                        </div>

                        {/* Tabla con scroll horizontal */}
                        <div className="overflow-x-auto rounded-xl border border-[#d4d8e8]">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-b from-[#2e3f84] to-[#263470] text-white">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Paciente</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Teléfono</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Documento</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fecha Cita</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Hora</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Médico</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Especialidad</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Consultorio</th>
                                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-[#e5e7f0]">
                                    {paginatedAppointments.map((appointment, index) => (
                                        <tr 
                                            key={appointment.id} 
                                            className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] transition-colors duration-150"
                                        >
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {(currentPage - 1) * itemsPerPage + index + 1}
                                            </td>
                                            <td className="px-4 py-3 text-[#2e3f84] font-medium whitespace-nowrap">
                                                {appointment.nom_paciente || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.pactel || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.citdoc || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.citfc || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.cithor || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.mednom || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.espnom || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointment.citcon || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[#6b7494] max-w-xs truncate" title={appointment.citobsobs || '-'}>
                                                {appointment.citobsobs || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-[#6b7494]">
                                    Página {currentPage} de {totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-2 rounded-lg border border-[#d4d8e8] text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Anterior
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-2 rounded-lg border border-[#d4d8e8] text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                    >
                                        Siguiente
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Instructions */}
                {initialAppointments.length === 0 && (
                    <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6"
                    >
                        <h3 className="font-semibold text-[#2e3f84] mb-4">
                            Formato del Archivo Excel
                        </h3>
                        <div className="space-y-3 text-sm text-[#6b7494]">
                            <p className="text-[#2e3f84] font-medium">El archivo debe contener las siguientes columnas:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">citead</strong> - Código admisión
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">nom_paciente</strong> - Nombre paciente
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">pactel</strong> - Teléfono
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">citfc</strong> - Fecha cita
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">cithor</strong> - Hora cita
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">mednom</strong> - Nombre médico
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">espnom</strong> - Especialidad
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">citdoc</strong> - Documento
                                </div>
                                <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-lg">
                                    <strong className="text-[#2e3f84]">citobsobs</strong> - Observaciones
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </AdminLayout>
    );
}
