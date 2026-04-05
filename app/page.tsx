'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { auth, db, googleProvider } from '@/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, CheckCircle2, LogOut, MapPin, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  fullName: z.string().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên quá dài'),
  contactInfo: z.string().min(8, 'SĐT/Zalo không hợp lệ').max(20, 'SĐT/Zalo quá dài'),
});

type FormData = z.infer<typeof formSchema>;

export default function Home() {
  const { user, loading } = useAuth();
  const [checkingIn, setCheckingIn] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean | null>(null);
  const [checkInData, setCheckInData] = useState<any>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (user?.email === 'phandu8899@gmail.com') {
        setIsAdmin(true);
      } else if (user?.email) {
        try {
          const docSnap = await getDocFromServer(doc(db, 'admins', user.email.toLowerCase()));
          setIsAdmin(docSnap.exists());
        } catch (e) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, [user]);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    async function checkExistingCheckIn() {
      if (user) {
        try {
          const docRef = doc(db, 'checkins', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setHasCheckedIn(true);
            setCheckInData(docSnap.data());
          } else {
            setHasCheckedIn(false);
          }
        } catch (error) {
          console.error("Error checking check-in status:", error);
        }
      } else {
        setHasCheckedIn(null);
        setCheckInData(null);
      }
    }
    checkExistingCheckIn();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
      alert("Đăng nhập thất bại. Vui lòng thử lại.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setCheckingIn(true);
    setLocationError(null);

    const saveCheckIn = async (lat: number, lng: number) => {
      try {
        const docRef = doc(db, 'checkins', user.uid);
        const checkInRecord = {
          uid: user.uid,
          email: user.email,
          fullName: data.fullName,
          contactInfo: data.contactInfo,
          timestamp: serverTimestamp(),
          latitude: lat,
          longitude: lng,
        };

        await setDoc(docRef, checkInRecord);
        setHasCheckedIn(true);
        setCheckInData({ ...checkInRecord, timestamp: new Date() }); // Optimistic UI update
      } catch (error) {
        console.error("Check-in error:", error);
        alert("Có lỗi xảy ra khi check-in. Vui lòng thử lại.");
      } finally {
        setCheckingIn(false);
      }
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          saveCheckIn(lat, lon);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          setLocationError("Không thể lấy vị trí. Vui lòng cấp quyền truy cập vị trí để check-in.");
          setCheckingIn(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError("Trình duyệt của bạn không hỗ trợ lấy vị trí.");
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="text-center">
          <h1 className="font-bold text-gray-900 tracking-tight">
            <span className="text-2xl sm:text-3xl uppercase">HỘI THẢO KHOA HỌC</span>
            <br />
            <span className="text-lg sm:text-xl mt-2 block text-blue-800">
              Tối ưu hóa liền thương và kiểm soát sẹo: Từ cơ chế sinh học đến chiến lược can thiệp lâm sàng ngay từ đầu
            </span>
          </h1>
          <p className="mt-3 text-sm font-medium text-gray-700">
            Trường Đại Học Y khoa Phạm Ngọc Thạch
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Ngày 11 tháng 04 năm 2026
          </p>
        </div>

        {!user ? (
          <div className="mt-8 space-y-6">
            <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 mb-6">
              Vui lòng đăng nhập bằng tài khoản Google để điểm danh. Mỗi sinh viên chỉ được điểm danh 1 lần.
            </div>
            <button
              onClick={handleLogin}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Đăng nhập với Google
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900 truncate max-w-[200px]">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {hasCheckedIn === null ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : hasCheckedIn ? (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Điểm danh thành công!</h2>
                <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 mt-4 text-sm">
                  <p><span className="text-gray-500">Họ và tên:</span> <span className="font-medium text-gray-900">{checkInData?.fullName}</span></p>
                  <p><span className="text-gray-500">SĐT/Zalo:</span> <span className="font-medium text-gray-900">{checkInData?.contactInfo}</span></p>
                  <p><span className="text-gray-500">Thời gian:</span> <span className="font-medium text-gray-900">
                    {checkInData?.timestamp?.toDate ? checkInData.timestamp.toDate().toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}
                  </span></p>
                </div>
                <p className="text-sm text-green-700 mt-4 bg-green-50 p-3 rounded-md">
                  Cảm ơn bạn đã tham gia Hội thảo Khoa học.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                    Họ và tên
                  </label>
                  <div className="mt-1">
                    <input
                      id="fullName"
                      type="text"
                      {...register('fullName')}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Nguyễn Văn A"
                    />
                    {errors.fullName && (
                      <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="contactInfo" className="block text-sm font-medium text-gray-700">
                    Thông tin liên hệ (SĐT/Zalo)
                  </label>
                  <div className="mt-1">
                    <input
                      id="contactInfo"
                      type="text"
                      {...register('contactInfo')}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="0901234567"
                    />
                    {errors.contactInfo && (
                      <p className="mt-1 text-sm text-red-600">{errors.contactInfo.message}</p>
                    )}
                  </div>
                </div>

                {locationError && (
                  <div className="flex items-start space-x-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{locationError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={checkingIn}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                >
                  {checkingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4 mr-2" />
                      Xác nhận Check-in
                    </>
                  )}
                </button>
                <p className="text-xs text-center text-gray-500 mt-4">
                  Hệ thống sẽ ghi nhận vị trí của bạn để đảm bảo tính minh bạch.
                </p>
              </form>
            )}
          </div>
        )}
        
        {isAdmin && (
          <div className="pt-6 mt-6 border-t border-gray-100 text-center">
            <Link href="/admin" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Truy cập trang Quản trị viên &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
