'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/firebase';
import { collection, getDocs, orderBy, query, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Download, ArrowLeft, Users, RefreshCw, CheckCircle2, XCircle, FileSpreadsheet, Shield, Trash2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';

interface CheckInRecord {
  uid: string;
  email: string;
  fullName: string;
  contactInfo: string;
  timestamp: any;
  latitude?: number;
  longitude?: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checkins' | 'crosscheck' | 'admins'>('checkins');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [syncingSheet, setSyncingSheet] = useState(false);
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminList, setAdminList] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = records.filter(record => {
    const query = searchQuery.toLowerCase();
    return (
      record.fullName.toLowerCase().includes(query) ||
      record.email.toLowerCase().includes(query) ||
      record.contactInfo.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    async function checkAdmin() {
      if (!user) {
        if (!loading) router.push('/');
        return;
      }
      if (user.email === 'phandu8899@gmail.com') {
        setIsAdmin(true);
        return;
      }
      try {
        const docRef = doc(db, 'admins', user.email!.toLowerCase());
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          router.push('/');
        }
      } catch (e) {
        setIsAdmin(false);
        router.push('/');
      }
    }
    if (!loading) checkAdmin();
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchRecords() {
      if (!isAdmin) return;
      
      try {
        const q = query(collection(db, 'checkins'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: CheckInRecord[] = [];
        querySnapshot.forEach((doc) => {
          data.push(doc.data() as CheckInRecord);
        });
        setRecords(data);
      } catch (err: any) {
        console.error("Error fetching records:", err);
        setError(err.message || "Không thể tải dữ liệu");
      } finally {
        setFetching(false);
      }
    }

    fetchRecords();
  }, [isAdmin]);

  const fetchAdmins = async () => {
    try {
      const snap = await getDocs(collection(db, 'admins'));
      setAdminList(snap.docs.map(d => d.data()));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'admins') {
      fetchAdmins();
    }
  }, [isAdmin, activeTab]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminEmail.includes('@')) return alert('Email không hợp lệ');
    try {
      const emailLower = newAdminEmail.toLowerCase().trim();
      await setDoc(doc(db, 'admins', emailLower), {
        email: emailLower,
        addedBy: user?.email,
        timestamp: serverTimestamp()
      });
      setNewAdminEmail('');
      fetchAdmins();
      alert('Đã thêm admin thành công');
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm admin. Đảm bảo bạn có quyền thực hiện.');
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email === 'phandu8899@gmail.com') return alert('Không thể xóa admin gốc');
    if (!confirm(`Bạn có chắc muốn xóa quyền admin của ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'admins', email));
      fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa admin');
    }
  };

  const exportToCSV = () => {
    const exportData = filteredRecords.map((record, index) => ({
      STT: index + 1,
      'Họ và tên': record.fullName,
      'SĐT/Zalo': record.contactInfo,
      'Email': record.email,
      'Thời gian': record.timestamp?.toDate ? record.timestamp.toDate().toLocaleString('vi-VN') : '',
      'Vĩ độ': record.latitude || '',
      'Kinh độ': record.longitude || '',
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DiemDanh_HoiThao_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchSheetData = async () => {
    setSyncingSheet(true);
    try {
      const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6nNnTkOsC_14ntN8ffbrY66sV4fhqbz_Th0Gy2KQqGYyHpItk6WiAerz74InEvDg8tHGp4c5Bfcq-/pub?gid=2060588202&single=true&output=csv";
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error("Network response was not ok");
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvData(results.data);
          setSyncingSheet(false);
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          alert("Lỗi khi đọc dữ liệu từ Google Sheet");
          setSyncingSheet(false);
        }
      });
    } catch (error) {
      console.error("Error fetching sheet:", error);
      alert("Không thể tải dữ liệu từ Google Sheet. Vui lòng kiểm tra lại link.");
      setSyncingSheet(false);
    }
  };

  const exportCrossCheckCSV = () => {
    const exportData = csvData.map((row, index) => {
      const email = row['Email']?.toString().trim().toLowerCase();
      const name = row['Họ và tên']?.toString().trim().toLowerCase();
      
      const matchedRecord = records.find(r => 
        (email && r.email.toLowerCase() === email) || 
        (name && r.fullName.toLowerCase() === name)
      );

      return {
        'STT': index + 1,
        'Họ và tên (Đăng ký)': row['Họ và tên'] || '',
        'Email (Đăng ký)': row['Email'] || '',
        'SĐT': row['Thông tin liên hệ (SĐT/Zalo)'] || '',
        'Trạng thái': matchedRecord ? 'Đã check-in' : 'Chưa check-in',
        'Họ tên (Check-in)': matchedRecord ? matchedRecord.fullName : '',
        'SĐT/Zalo (Check-in)': matchedRecord ? matchedRecord.contactInfo : '',
        'Thời gian Check-in': matchedRecord?.timestamp?.toDate ? matchedRecord.timestamp.toDate().toLocaleString('vi-VN') : '',
      };
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DoiSoat_DiemDanh_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-xl shadow-sm border border-gray-100 gap-4">
          <div className="flex items-center space-x-4">
            <Link href="/" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản trị viên</h1>
              <p className="text-sm text-gray-500">Hệ thống quản lý điểm danh</p>
            </div>
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('checkins')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'checkins' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Danh sách Check-in
            </button>
            <button
              onClick={() => setActiveTab('crosscheck')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'crosscheck' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Đối soát danh sách
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'admins' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Quản lý Admin
            </button>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
            {error}
          </div>
        ) : fetching ? (
          <div className="flex justify-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : activeTab === 'checkins' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div className="flex items-center space-x-2 text-sm font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                <Users className="w-4 h-4" />
                <span>Tổng cộng: {filteredRecords.length} lượt check-in</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm tên, email, SĐT..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <button
                  onClick={exportToCSV}
                  disabled={filteredRecords.length === 0}
                  className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Xuất CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SĐT/Zalo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Không tìm thấy kết quả nào.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr key={record.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.fullName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.contactInfo}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.timestamp?.toDate ? record.timestamp.toDate().toLocaleString('vi-VN') : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'crosscheck' ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Đối soát danh sách đăng ký</h3>
                <p className="text-sm text-gray-500">Đồng bộ trực tiếp từ Google Sheet để kiểm tra ai đã check-in.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchSheetData}
                  disabled={syncingSheet}
                  className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncingSheet ? 'animate-spin' : ''}`} />
                  {syncingSheet ? 'Đang đồng bộ...' : 'Đồng bộ Google Sheet'}
                </button>
                {csvData.length > 0 && (
                  <button
                    onClick={exportCrossCheckCSV}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Xuất kết quả
                  </button>
                )}
              </div>
            </div>

            {csvData.length === 0 ? (
              <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                <div className="bg-blue-50 p-4 rounded-full mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dữ liệu đối soát</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  Nhấn nút đồng bộ để hệ thống tự động tải danh sách từ Google Sheet và đối chiếu với dữ liệu check-in thực tế.
                </p>
                <button
                  onClick={fetchSheetData}
                  disabled={syncingSheet}
                  className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncingSheet ? 'animate-spin' : ''}`} />
                  {syncingSheet ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex gap-6 text-sm">
                  <div className="flex items-center text-gray-700">
                    <span className="font-medium mr-2">Tổng danh sách:</span> {csvData.length}
                  </div>
                  <div className="flex items-center text-green-700">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    <span className="font-medium mr-2">Đã check-in:</span> 
                    {csvData.filter(row => {
                      const email = row['Email']?.toString().trim().toLowerCase();
                      const name = row['Họ và tên']?.toString().trim().toLowerCase();
                      return records.some(r => (email && r.email.toLowerCase() === email) || (name && r.fullName.toLowerCase() === name));
                    }).length}
                  </div>
                  <div className="flex items-center text-red-700">
                    <XCircle className="w-4 h-4 mr-1" />
                    <span className="font-medium mr-2">Chưa check-in:</span>
                    {csvData.filter(row => {
                      const email = row['Email']?.toString().trim().toLowerCase();
                      const name = row['Họ và tên']?.toString().trim().toLowerCase();
                      return !records.some(r => (email && r.email.toLowerCase() === email) || (name && r.fullName.toLowerCase() === name));
                    }).length}
                  </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ và tên (Đăng ký)</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SĐT</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thông tin Check-in</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvData.map((row, index) => {
                      const email = row['Email']?.toString().trim().toLowerCase();
                      const name = row['Họ và tên']?.toString().trim().toLowerCase();
                      
                      const matchedRecord = records.find(r => 
                        (email && r.email.toLowerCase() === email) || 
                        (name && r.fullName.toLowerCase() === name)
                      );

                      return (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row['Họ và tên'] || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row['Email'] || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row['Thông tin liên hệ (SĐT/Zalo)'] || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {matchedRecord ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Đã check-in
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                Chưa check-in
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {matchedRecord ? (
                              <div className="flex flex-col">
                                <span className="text-gray-900">{matchedRecord.timestamp?.toDate ? matchedRecord.timestamp.toDate().toLocaleString('vi-VN') : ''}</span>
                                <span className="text-xs">SĐT/Zalo: {matchedRecord.contactInfo}</span>
                              </div>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Quản lý quyền Admin</h3>
                <p className="text-sm text-gray-500">Thêm hoặc xóa quyền truy cập trang quản trị cho các email khác.</p>
              </div>
            </div>
            
            <div className="p-6 border-b border-gray-100">
              <form onSubmit={handleAddAdmin} className="flex gap-3 max-w-md">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="Nhập email cần cấp quyền..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 border"
                  required
                />
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email Admin</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người thêm</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian thêm</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                      <Shield className="w-4 h-4 text-blue-600 mr-2" />
                      phandu8899@gmail.com
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Admin gốc
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Hệ thống</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className="text-gray-400 cursor-not-allowed">Không thể xóa</span>
                    </td>
                  </tr>
                  {adminList.map((admin) => (
                    <tr key={admin.email} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{admin.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{admin.addedBy}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {admin.timestamp?.toDate ? admin.timestamp.toDate().toLocaleString('vi-VN') : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleRemoveAdmin(admin.email)}
                          className="text-red-600 hover:text-red-900 flex items-center justify-end w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
