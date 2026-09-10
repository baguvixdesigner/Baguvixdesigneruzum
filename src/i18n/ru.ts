export const ru = {
  chooseLanguage: "Выберите язык / Tilni tanlang:",
  languageSet: "Язык установлен: Русский 🇷🇺",

  mainMenuTitle: "Главное меню",
  btnFindProducts: "🔍 Найти товары",
  btnWallet: "💼 Кошелёк: {{balance}}",
  btnSupport: "💬 Поддержка",
  btnLanguage: "🌐 Язык",
  btnBack: "⬅️ Назад",
  btnMainMenu: "🏠 Главное меню",

  chooseGroup: "Выберите категорию товаров:",
  chooseSubcategory: "Выберите подкатегорию:",
  chooseSource: "Откуда искать товары?",
  sourceTaobao: "Taobao",
  source1688: "1688",
  sourceBoth: "Taobao + 1688",

  insufficientBalance:
    "Недостаточно средств.\nСтоимость запроса: {{price}}.\nВаш баланс: {{balance}}.",
  btnTopUp: "💳 Пополнить баланс",

  collectingData: "⏳ Собираем данные, это может занять около 20-30 секунд...",

  resultHeader: "📦 Топ-{{count}}: {{category}} ({{source}})\nОбновлено: {{date}}\n",
  resultItem:
    "{{index}}. {{title}}\n   ¥{{priceCny}} (~{{priceUzs}})\n   {{noveltyEmoji}} {{noveltyText}}\n   🔗 {{url}}",
  noveltyGreen: "Почти нет на Uzum",
  noveltyYellow: "Есть немного",
  noveltyRed: "Уже активно продают",

  btnMore10: "➕ Ещё 10 ({{price}})",
  btnSuggestCategory: "💡 Предложить свою категорию",
  suggestCategoryPrompt: "Напишите название категории, которую хотите добавить:",
  suggestCategoryThanks: "Спасибо! Ваше предложение отправлено на рассмотрение.",

  noMoreProducts: "Больше товаров по этой категории пока нет в кэше. Попробуйте позже.",

  walletTitle: "💼 Ваш кошелёк\nБаланс: {{balance}}",
  btnTopUpCard: "Переводом на карту",
  askTopUpAmount: "Впишите сумму пополнения (минимум {{min}}):",
  amountTooSmall: "Сумма меньше минимальной ({{min}}). Введите сумму ещё раз:",
  amountNotNumber: "Введите сумму цифрами. Попробуйте ещё раз:",
  topUpCardDetails:
    "Переведите {{amount}} на карту:\n💳 {{card}}\n👤 {{holder}}\n\nПосле перевода нажмите «Подтвердить платёж».",
  btnConfirmPayment: "✅ Подтвердить платёж",
  askScreenshot: "Отправьте скриншот платежа (фото или файл):",
  topUpPending: "Подождите немного, мы проверяем платёж ⏳",
  topUpConfirmed: "✅ Баланс пополнен на {{amount}}. Текущий баланс: {{balance}}",
  topUpRejected: "❌ Платёж не подтверждён. Свяжитесь с поддержкой.",
  screenshotRequired: "Пожалуйста, отправьте именно фото/скриншот платежа.",

  supportText: "По любым вопросам пишите напрямую:",

  adminTopUpNotification:
    "🆕 Заявка на пополнение\nПользователь: {{userLabel}}\nСумма: {{amount}}",
  btnAdminApprove: "✅ Подтвердить",
  btnAdminReject: "❌ Отклонить",
  adminApproved: "Заявка подтверждена.",
  adminRejected: "Заявка отклонена.",

  adminNewSuggestion: "💡 Новая категория от пользователя {{userLabel}}:\n«{{text}}»",
  btnAdminAddCategory: "➕ Добавить в список",
  btnAdminRejectSuggestion: "🚫 Отклонить",
  adminSuggestionAdded: "Предложение принято.",
  adminSuggestionRejected: "Предложение отклонено.",

  genericError: "Что-то пошло не так. Попробуйте ещё раз или напишите в поддержку.",
  notAdmin: "Эта команда доступна только администратору.",
};

export type Dictionary = typeof ru;
