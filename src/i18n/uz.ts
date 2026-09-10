import type { Dictionary } from "./ru";

export const uz: Dictionary = {
  chooseLanguage: "Выберите язык / Tilni tanlang:",
  languageSet: "Til o'rnatildi: O'zbekcha 🇺🇿",

  mainMenuTitle: "Bosh menyu",
  btnFindProducts: "🔍 Mahsulot topish",
  btnWallet: "💼 Hamyon: {{balance}}",
  btnSupport: "💬 Yordam",
  btnLanguage: "🌐 Til",
  btnBack: "⬅️ Orqaga",
  btnMainMenu: "🏠 Bosh menyu",

  chooseGroup: "Mahsulot toifasini tanlang:",
  chooseSubcategory: "Kichik toifani tanlang:",
  chooseSource: "Mahsulotlarni qayerdan izlaymiz?",
  sourceTaobao: "Taobao",
  source1688: "1688",
  sourceBoth: "Taobao + 1688",

  insufficientBalance:
    "Hisobingizda mablag' yetarli emas.\nSo'rov narxi: {{price}}.\nBalansingiz: {{balance}}.",
  btnTopUp: "💳 Hisobni to'ldirish",

  collectingData: "⏳ Ma'lumotlar yig'ilmoqda, bu taxminan 20-30 soniya vaqt oladi...",

  resultHeader: "📦 TOP-{{count}}: {{category}} ({{source}})\nYangilangan: {{date}}\n",
  resultItem:
    "{{index}}. {{title}}\n   ¥{{priceCny}} (~{{priceUzs}})\n   {{noveltyEmoji}} {{noveltyText}}\n   🔗 {{url}}",
  noveltyGreen: "Uzumda deyarli yo'q",
  noveltyYellow: "Biroz bor",
  noveltyRed: "Allaqachon faol sotilmoqda",

  btnMore10: "➕ Yana 10 ta ({{price}})",
  btnSuggestCategory: "💡 O'z toifangizni taklif qiling",
  suggestCategoryPrompt: "Qo'shmoqchi bo'lgan toifa nomini yozing:",
  suggestCategoryThanks: "Rahmat! Taklifingiz ko'rib chiqish uchun yuborildi.",

  noMoreProducts: "Bu toifa bo'yicha hozircha boshqa mahsulot yo'q. Keyinroq urinib ko'ring.",

  walletTitle: "💼 Sizning hamyoningiz\nBalans: {{balance}}",
  btnTopUpCard: "Kartaga o'tkazma orqali",
  askTopUpAmount: "To'ldirish summasini kiriting (minimum {{min}}):",
  amountTooSmall: "Summa minimal miqdordan kam ({{min}}). Qaytadan kiriting:",
  amountNotNumber: "Summani raqamlarda kiriting. Qaytadan urinib ko'ring:",
  topUpCardDetails:
    "{{amount}} miqdorini kartaga o'tkazing:\n💳 {{card}}\n👤 {{holder}}\n\nO'tkazmadan so'ng «To'lovni tasdiqlash» tugmasini bosing.",
  btnConfirmPayment: "✅ To'lovni tasdiqlash",
  askScreenshot: "To'lov skrinshotini yuboring (rasm yoki fayl):",
  topUpPending: "Biroz kuting, to'lovni tekshiryapmiz ⏳",
  topUpConfirmed: "✅ Hisobingiz {{amount}} ga to'ldirildi. Joriy balans: {{balance}}",
  topUpRejected: "❌ To'lov tasdiqlanmadi. Yordam xizmatiga murojaat qiling.",
  screenshotRequired: "Iltimos, to'lov skrinshotini (rasm) yuboring.",

  supportText: "Har qanday savollar bo'yicha to'g'ridan-to'g'ri yozing:",

  adminTopUpNotification:
    "🆕 Hisobni to'ldirish so'rovi\nFoydalanuvchi: {{userLabel}}\nSumma: {{amount}}",
  btnAdminApprove: "✅ Tasdiqlash",
  btnAdminReject: "❌ Rad etish",
  adminApproved: "So'rov tasdiqlandi.",
  adminRejected: "So'rov rad etildi.",

  adminNewSuggestion: "💡 Foydalanuvchidan yangi toifa {{userLabel}}:\n«{{text}}»",
  btnAdminAddCategory: "➕ Ro'yxatga qo'shish",
  btnAdminRejectSuggestion: "🚫 Rad etish",
  adminSuggestionAdded: "Taklif qabul qilindi.",
  adminSuggestionRejected: "Taklif rad etildi.",

  genericError: "Nimadir xato ketdi. Qaytadan urinib ko'ring yoki yordam xizmatiga yozing.",
  notAdmin: "Bu buyruq faqat administrator uchun mavjud.",
};
