importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCXRkBLUlgKci0zaVYi_dDIWWpjrApfz_4",
  authDomain: "pemuda-qoryah-babakan.firebaseapp.com",
  projectId: "pemuda-qoryah-babakan",
  storageBucket: "pemuda-qoryah-babakan.firebasestorage.app",
  messagingSenderId: "273692298898",
  appId: "1:273692298898:web:e09bcb6d02e8d6c795204b",
  measurementId: "G-T07XPPLS8M"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {

  // Jika ada payload notification,
  // biarkan Firebase menampilkannya otomatis.
  if (payload.notification) {
    return;
  }

  // Untuk pesan data-only, tampilkan manual.
  const notificationTitle =
    payload.data?.title ||
    'Pemuda Qoryah Babakan';

  const notificationOptions = {
    body:
      payload.data?.body ||
      'Ada informasi baru.',

    icon: './assets/image/pemudalogo.svg',

    data: {
      url: payload.data?.url || './'
    }
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );

});
