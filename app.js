// ============================================================
// TRANSACTION PAPER
// Firebase Authentication + Cloud Firestore
// ============================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCr1-XBIc_5obn8uOgHfIjriElT3kaK1Io",
  authDomain: "transaction-paper.firebaseapp.com",
  projectId: "transaction-paper",
  storageBucket: "transaction-paper.firebasestorage.app",
  messagingSenderId: "128178860545",
  appId: "1:128178860545:web:ff3b5118e4e71a851d4600"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;

let people = [];

let transactions = [];


// ============================================================
// SHORT ELEMENT HELPER
// ============================================================

const $ = (id) => document.getElementById(id);


// ============================================================
// CURRENCY FORMAT
// ============================================================

function formatCurrency(value) {

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ============================================================
// TODAY DATE
// ============================================================

function todayISO() {

  return new Date()
    .toISOString()
    .slice(0, 10);

}


// ============================================================
// INITIALS
// ============================================================

function initials(name) {

  const value =
    String(name || "U").trim();

  return value
    ? value.charAt(0).toUpperCase()
    : "U";

}


// ============================================================
// FIRESTORE REFERENCES
// ============================================================

function userPeopleRef() {

  if (!currentUser) {
    throw new Error("User not authenticated.");
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    "people"
  );

}


function userTransactionsRef() {

  if (!currentUser) {
    throw new Error("User not authenticated.");
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    "transactions"
  );

}


// ============================================================
// TOAST
// ============================================================

function showToast(
  message,
  duration = 2600
) {

  const toast =
    $("toast");

  const content =
    $("toastContent");

  if (!toast || !content) {
    alert(message);
    return;
  }

  content.textContent = message;

  toast.classList.remove("hidden");

  clearTimeout(
    window.__tpToastTimer
  );

  window.__tpToastTimer =
    setTimeout(() => {

      toast.classList.add("hidden");

    }, duration);

}

window.showToast = showToast;


// ============================================================
// MODALS
// ============================================================

function openModal(modal) {

  if (!modal) return;

  modal.classList.remove("hidden");

  modal.classList.add("flex");

}


function closeModal(modal) {

  if (!modal) return;

  modal.classList.add("hidden");

  modal.classList.remove("flex");

}


// ============================================================
// PERSON SUMMARY
// ============================================================

function getPersonSummary(personId) {

  let given = 0;

  let received = 0;


  const personTransactions =
    transactions.filter(
      transaction =>
        transaction.personId === personId
    );


  for (
    const transaction
    of personTransactions
  ) {

    if (
      transaction.type === "given"
    ) {

      given +=
        Number(transaction.amount || 0);

    }


    if (
      transaction.type === "received"
    ) {

      received +=
        Number(transaction.amount || 0);

    }

  }


  return {

    given,

    received,

    balance:
      given - received,

    transactions:
      personTransactions

  };

}


// ============================================================
// WHATSAPP LINK
// ============================================================

function createWhatsAppLink(
  person,
  balance
) {

  let phone =
    String(person.phone || "")
      .replace(/\D/g, "");


  if (
    phone.length === 10
  ) {

    phone =
      "91" + phone;

  }


  const message =
`Hello ${person.name || ""},

This is a reminder regarding your Transaction Paper ledger.

Outstanding balance: ${formatCurrency(balance)}

Thank you.`;


  return (
    "https://wa.me/" +
    phone +
    "?text=" +
    encodeURIComponent(message)
  );

}


// ============================================================
// GOOGLE LOGIN
// ============================================================

$("googleLoginBtn")
  ?.addEventListener(
    "click",
    async () => {

      try {

        showToast(
          "Opening Google sign-in..."
        );

        await signInWithPopup(
          auth,
          googleProvider
        );

      } catch (error) {

        console.error(
          "Google sign-in error:",
          error
        );

        showToast(
          error?.message ||
          "Google sign-in failed."
        );

      }

    }
  );


// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn")
  ?.addEventListener(
    "click",
    async () => {

      try {

        await signOut(auth);

      } catch (error) {

        console.error(
          "Sign out error:",
          error
        );

        showToast(
          "Could not sign out."
        );

      }

    }
  );


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async (user) => {

    currentUser =
      user || null;


    const loginScreen =
      $("loginScreen");


    if (!user) {

      loginScreen
        ?.classList.remove(
          "hidden"
        );

      people = [];

      transactions = [];

      updateAllViews();

      return;

    }


    loginScreen
      ?.classList.add(
        "hidden"
      );


    updateUserUI(user);


    try {

      await loadPeople();

      await loadTransactions();

      updateAllViews();

    } catch (error) {

      console.error(
        "Initial data loading failed:",
        error
      );

      showToast(
        "Could not load your cloud data."
      );

    }

  }
);


// ============================================================
// UPDATE USER UI
// ============================================================

function updateUserUI(user) {

  const name =
    user.displayName ||
    "User";


  const email =
    user.email ||
    "Signed in";


  const photo =
    user.photoURL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`;


  if ($("userName")) {

    $("userName").textContent =
      name;

  }


  if ($("userEmail")) {

    $("userEmail").textContent =
      email;

  }


  if ($("userPhoto")) {

    $("userPhoto").src =
      photo;

  }


  if ($("settingsUserName")) {

    $("settingsUserName").textContent =
      name;

  }


  if ($("settingsUserEmail")) {

    $("settingsUserEmail").textContent =
      email;

  }


  if ($("settingsUserPhoto")) {

    $("settingsUserPhoto").src =
      photo;

  }

}


// ============================================================
// LOAD PEOPLE
// ============================================================

async function loadPeople() {

  if (!currentUser) {
    return;
  }


  const q =
    query(
      userPeopleRef(),
      orderBy(
        "createdAt",
        "desc"
      )
    );


  const snapshot =
    await getDocs(q);


  people =
    snapshot.docs.map(
      item => ({

        id: item.id,

        ...item.data()

      })
    );

}


// ============================================================
// LOAD TRANSACTIONS
// ============================================================

async function loadTransactions() {

  if (!currentUser) {
    return;
  }


  const q =
    query(
      userTransactionsRef(),
      orderBy(
        "date",
        "desc"
      )
    );


  const snapshot =
    await getDocs(q);


  transactions =
    snapshot.docs.map(
      item => ({

        id: item.id,

        ...item.data()

      })
    );

}


// ============================================================
// ADD PERSON
// ============================================================

$("personForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (!currentUser) {

        showToast(
          "Please sign in first."
        );

        return;

      }


      const name =
        $("personName")
          ?.value
          .trim() || "";


      const phone =
        $("personPhone")
          ?.value
          .trim() || "";


      const note =
        $("personNote")
          ?.value
          .trim() || "";


      if (!name) {

        showToast(
          "Please enter a name."
        );

        return;

      }


      try {

        await addDoc(
          userPeopleRef(),
          {

            ownerUid:
              currentUser.uid,

            name,

            phone,

            note,

            createdAt:
              serverTimestamp()

          }
        );


        event.target.reset();


        closeModal(
          $("personModal")
        );


        showToast(
          "Person saved successfully."
        );


        await loadPeople();


        updateAllViews();


      } catch (error) {

        console.error(
          "Add person error:",
          error
        );


        showToast(
          "Could not save person."
        );

      }

    }
  );


// ============================================================
// ADD TRANSACTION
// ============================================================

$("transactionForm")
  ?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (!currentUser) {

        showToast(
          "Please sign in first."
        );

        return;

      }


      const type =
        document.querySelector(
          'input[name="transactionType"]:checked'
        )?.value ||
        "given";


      const personId =
        $("transactionPerson")
          ?.value || "";


      const amount =
        Number(
          $("transactionAmount")
            ?.value || 0
        );


      const date =
        $("transactionDate")
          ?.value || "";


      const note =
        $("transactionNote")
          ?.value
          .trim() || "";


      if (!personId) {

        showToast(
          "Please select a person."
        );

        return;

      }


      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        showToast(
          "Please enter a valid amount."
        );

        return;

      }


      if (!date) {

        showToast(
          "Please select a date."
        );

        return;

      }


      const person =
        people.find(
          item =>
            item.id === personId
        );


      try {

        await addDoc(
          userTransactionsRef(),
          {

            ownerUid:
              currentUser.uid,

            personId,

            personName:
              person?.name ||
              "Unknown",

            type,

            amount,

            date,

            note,

            createdAt:
              serverTimestamp()

          }
        );


        event.target.reset();


        if (
          $("transactionDate")
        ) {

          $("transactionDate").value =
            todayISO();

        }


        closeModal(
          $("transactionModal")
        );


        showToast(
          "Transaction saved successfully."
        );


        await loadTransactions();


        updateAllViews();


      } catch (error) {

        console.error(
          "Add transaction error:",
          error
        );


        showToast(
          "Could not save transaction."
        );

      }

    }
  );


// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard() {

  let given = 0;

  let received = 0;


  for (
    const transaction
    of transactions
  ) {

    if (
      transaction.type === "given"
    ) {

      given +=
        Number(transaction.amount || 0);

    }


    if (
      transaction.type === "received"
    ) {

      received +=
        Number(transaction.amount || 0);

    }

  }


  const balance =
    given - received;


  if ($("totalGiven")) {

    $("totalGiven").textContent =
      formatCurrency(given);

  }


  if ($("totalReceived")) {

    $("totalReceived").textContent =
      formatCurrency(received);

  }


  if ($("netBalance")) {

    $("netBalance").textContent =
      formatCurrency(balance);

  }

}


// ============================================================
// DASHBOARD PEOPLE
// ============================================================

function renderDashboardPeople() {

  const container =
    $("peopleList");


  if (!container) {
    return;
  }


  const search =
    (
      $("personSearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();


  const filtered =
    people.filter(
      person => {

        const name =
          String(
            person.name || ""
          )
            .toLowerCase();


        const phone =
          String(
            person.phone || ""
          );


        return (
          !search ||
          name.includes(search) ||
          phone.includes(search)
        );

      }
    );


  if (!filtered.length) {

    container.innerHTML = `

      <div class="p-10 text-center">

        <div class="text-4xl mb-3">
          👥
        </div>

        <h4 class="font-bold">
          No accounts yet
        </h4>

        <p class="text-sm text-slate-500 mt-1">
          Add your first person to start tracking transactions.
        </p>

        <button
          id="dashboardAddPerson"
          class="mt-4 px-4 py-2.5 rounded-xl
                 bg-primary-600 text-white
                 font-semibold">

          + Add Person

        </button>

      </div>

    `;


    $("dashboardAddPerson")
      ?.addEventListener(
        "click",
        () => {

          openModal(
            $("personModal")
          );

        }
      );


    return;

  }


  container.innerHTML =
    filtered
      .slice(0, 8)
      .map(
        person => {

          const summary =
            getPersonSummary(
              person.id
            );


          const due =
            summary.balance > 0;


          return `

            <button
              class="w-full p-4 text-left
                     hover:bg-slate-50
                     dark:hover:bg-slate-800
                     transition person-row"
              data-person-id="${person.id}">

              <div class="flex items-center gap-3">

                <div
                  class="w-11 h-11 rounded-full
                         bg-primary-100
                         dark:bg-primary-500/20
                         text-primary-700
                         dark:text-primary-400
                         flex items-center justify-center
                         font-bold">

                  ${escapeHTML(
                    initials(
                      person.name
                    )
                  )}

                </div>

                <div
                  class="flex-1 min-w-0">

                  <p
                    class="font-semibold truncate">

                    ${escapeHTML(
                      person.name
                    )}

                  </p>

                  <p
                    class="text-xs text-slate-500">

                    ${
                      escapeHTML(
                        person.phone ||
                        "No phone"
                      )
                    }

                  </p>

                </div>

                <div class="text-right">

                  <p class="font-bold">

                    ${formatCurrency(
                      summary.balance
                    )}

                  </p>

                  <span
                    class="text-[11px] font-semibold ${
                      due
                        ? "text-red-600"
                        : "text-emerald-600"
                    }">

                    ${
                      due
                        ? "Dues"
                        : "Settled"
                    }

                  </span>

                </div>

              </div>

            </button>

          `;

        }
      )
      .join("");


  document
    .querySelectorAll(
      ".person-row"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openPersonDetail(
              button.dataset.personId
            );

          }
        );

      }
    );

}


// ============================================================
// PEOPLE PAGE
// ============================================================

function renderPeople() {

  const container =
    $("allPeopleList");


  if (!container) {
    return;
  }


  const search =
    (
      $("peoplePageSearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();


  const filter =
    $("statusFilter")
      ?.value ||
    "all";


  const sort =
    $("sortPeople")
      ?.value ||
    "name";


  let list =
    [...people];


  list =
    list.filter(
      person => {

        const summary =
          getPersonSummary(
            person.id
          );


        const due =
          summary.balance > 0;


        const matchSearch =
          !search ||
          String(
            person.name || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            person.phone || ""
          )
            .toLowerCase()
            .includes(search);


        const matchFilter =
          filter === "all" ||
          (
            filter === "due" &&
            due
          ) ||
          (
            filter === "settled" &&
            !due
          );


        return (
          matchSearch &&
          matchFilter
        );

      }
    );


  if (sort === "name") {

    list.sort(
      (a, b) =>
        String(
          a.name || ""
        ).localeCompare(
          String(
            b.name || ""
          )
        )
    );

  }


  if (sort === "balance") {

    list.sort(
      (a, b) =>
        getPersonSummary(
          b.id
        ).balance -
        getPersonSummary(
          a.id
        ).balance
    );

  }


  if (sort === "recent") {

    list.reverse();

  }


  if (!list.length) {

    container.innerHTML = `

      <div
        class="md:col-span-2
               xl:col-span-3
               bg-white dark:bg-slate-900
               border border-slate-200
               dark:border-slate-800
               rounded-2xl
               p-10 text-center">

        <div class="text-4xl mb-3">
          👥
        </div>

        <p class="font-semibold">
          No people found.
        </p>

        <p class="text-sm text-slate-500 mt-1">
          Try changing your search or filters.
        </p>

      </div>

    `;


    return;

  }


  container.innerHTML =
    list
      .map(
        person => {

          const summary =
            getPersonSummary(
              person.id
            );


          const due =
            summary.balance > 0;


          return `

            <div
              class="bg-white dark:bg-slate-900
                     border border-slate-200
                     dark:border-slate-800
                     rounded-2xl p-5">

              <div class="flex items-center gap-3">

                <div
                  class="w-12 h-12 rounded-full
                         bg-primary-100
                         dark:bg-primary-500/20
                         text-primary-700
                         flex items-center justify-center
                         font-bold text-lg">

                  ${escapeHTML(
                    initials(
                      person.name
                    )
                  )}

                </div>


                <div
                  class="flex-1 min-w-0">

                  <h3 class="font-bold truncate">

                    ${escapeHTML(
                      person.name
                    )}

                  </h3>

                  <p
                    class="text-sm text-slate-500 truncate">

                    ${escapeHTML(
                      person.phone ||
                      "No phone"
                    )}

                  </p>

                </div>


                <span
                  class="px-2.5 py-1
                         rounded-full
                         text-[11px]
                         font-bold
                         ${
                           due
                             ? "bg-red-50 text-red-600 dark:bg-red-500/10"
                             : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                         }">

                  ${
                    due
                      ? "Dues"
                      : "Settled"
                  }

                </span>

              </div>


              <div
                class="grid grid-cols-3 gap-2 mt-5">

                <div
                  class="p-3 rounded-xl
                         bg-red-50
                         dark:bg-red-500/10">

                  <p class="text-[11px] text-slate-500">
                    Given
                  </p>

                  <p class="text-sm font-bold mt-1">

                    ${formatCurrency(
                      summary.given
                    )}

                  </p>

                </div>


                <div
                  class="p-3 rounded-xl
                         bg-emerald-50
                         dark:bg-emerald-500/10">

                  <p class="text-[11px] text-slate-500">
                    Received
                  </p>

                  <p class="text-sm font-bold mt-1">

                    ${formatCurrency(
                      summary.received
                    )}

                  </p>

                </div>


                <div
                  class="p-3 rounded-xl
                         bg-blue-50
                         dark:bg-blue-500/10">

                  <p class="text-[11px] text-slate-500">
                    Balance
                  </p>

                  <p class="text-sm font-bold mt-1">

                    ${formatCurrency(
                      summary.balance
                    )}

                  </p>

                </div>

              </div>


              <div
                class="flex gap-2 mt-5">

                <button
                  class="person-open
                         flex-1
                         px-3 py-2.5
                         rounded-xl
                         bg-primary-600
                         text-white
                         text-sm
                         font-semibold"
                  data-person-id="${person.id}">

                  View Ledger

                </button>


                ${
                  person.phone
                    ? `
                      <a
                        target="_blank"
                        rel="noopener"
                        href="${createWhatsAppLink(
                          person,
                          summary.balance
                        )}"
                        class="px-3 py-2.5
                               rounded-xl
                               border
                               border-slate-200
                               dark:border-slate-700
                               text-sm
                               font-semibold">

                        WhatsApp

                      </a>
                    `
                    : ""
                }

              </div>

            </div>

          `;

        }
      )
      .join("");


  document
    .querySelectorAll(
      ".person-open"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            openPersonDetail(
              button.dataset.personId
            );

          }
        );

      }
    );

}


window.renderPeople =
  renderPeople;


// ============================================================
// TRANSACTIONS PAGE
// ============================================================

function renderTransactions() {

  const container =
    $("transactionsList");


  if (!container) {
    return;
  }


  const search =
    (
      $("transactionSearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();


  const list =
    transactions.filter(
      transaction => {

        const text =
          [

            transaction.personName,

            transaction.note,

            transaction.type,

            transaction.date

          ]
            .join(" ")
            .toLowerCase();


        return (
          !search ||
          text.includes(search)
        );

      }
    );


  if (!list.length) {

    container.innerHTML = `

      <div class="p-10 text-center text-slate-500">

        No transactions found.

      </div>

    `;


    return;

  }


  container.innerHTML =
    list
      .map(
        transaction => {

          const given =
            transaction.type ===
            "given";


          return `

            <div class="p-4">

              <div class="flex items-start gap-3">

                <div
                  class="w-10 h-10
                         rounded-full
                         ${
                           given
                             ? "bg-red-50 text-red-600 dark:bg-red-500/10"
                             : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                         }
                         flex items-center justify-center">

                  ${
                    given
                      ? "↑"
                      : "↓"
                  }

                </div>


                <div
                  class="flex-1 min-w-0">

                  <div
                    class="flex justify-between gap-3">

                    <div>

                      <p class="font-semibold">

                        ${escapeHTML(
                          transaction.personName
                        )}

                      </p>

                      <p
                        class="text-xs text-slate-500 mt-1">

                        ${escapeHTML(
                          transaction.date ||
                          ""
                        )}

                      </p>

                    </div>


                    <p
                      class="font-bold whitespace-nowrap
                             ${
                               given
                                 ? "text-red-600"
                                 : "text-emerald-600"
                             }">

                      ${
                        given
                          ? "+"
                          : "-"
                      }

                      ${formatCurrency(
                        transaction.amount
                      )}

                    </p>

                  </div>


                  ${
                    transaction.note
                      ? `
                        <p
                          class="text-sm text-slate-500 mt-2">

                          ${escapeHTML(
                            transaction.note
                          )}

                        </p>
                      `
                      : ""
                  }

                </div>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


window.renderTransactions =
  renderTransactions;


// ============================================================
// PERSON DETAIL
// ============================================================

function openPersonDetail(
  personId
) {

  const person =
    people.find(
      p => p.id === personId
    );


  if (!person) {
    return;
  }


  const summary =
    getPersonSummary(
      personId
    );


  if ($("detailAvatar")) {

    $("detailAvatar").textContent =
      initials(
        person.name
      );

  }


  if ($("detailName")) {

    $("detailName").textContent =
      person.name ||
      "Person";

  }


  if ($("detailPhone")) {

    $("detailPhone").textContent =
      person.phone ||
      "No phone number";

  }


  if ($("detailGiven")) {

    $("detailGiven").textContent =
      formatCurrency(
        summary.given
      );

  }


  if ($("detailReceived")) {

    $("detailReceived").textContent =
      formatCurrency(
        summary.received
      );

  }


  if ($("detailBalance")) {

    $("detailBalance").textContent =
      formatCurrency(
        summary.balance
      );

  }


  const whatsapp =
    $("whatsappReminder");


  if (whatsapp) {

    if (person.phone) {

      whatsapp.href =
        createWhatsAppLink(
          person,
          summary.balance
        );

      whatsapp.classList.remove(
        "hidden"
      );

    } else {

      whatsapp.classList.add(
        "hidden"
      );

    }

  }


  renderTimeline(
    summary.transactions
  );


  openModal(
    $("personDetailModal")
  );

}


window.openPersonDetail =
  openPersonDetail;


// ============================================================
// TIMELINE
// ============================================================

function renderTimeline(
  personTransactions
) {

  const container =
    $("personTimeline");


  if (!container) {
    return;
  }


  if (!personTransactions.length) {

    container.innerHTML = `

      <div
        class="text-center
               text-slate-500
               py-8">

        No transactions.

      </div>

    `;


    return;

  }


  const sorted =
    [...personTransactions]
      .sort(
        (a, b) =>
          String(
            b.date || ""
          ).localeCompare(
            String(
              a.date || ""
            )
          )
      );


  container.innerHTML =
    sorted
      .map(
        transaction => {

          const given =
            transaction.type ===
            "given";


          return `

            <div
              class="relative pl-8">

              <div
                class="absolute left-0 top-1
                       w-4 h-4 rounded-full
                       ${
                         given
                           ? "bg-red-500"
                           : "bg-emerald-500"
                       }">

              </div>


              <div
                class="p-4 rounded-xl
                       bg-slate-50
                       dark:bg-slate-800">

                <div
                  class="flex justify-between gap-3">

                  <div>

                    <p class="font-semibold">

                      ${
                        given
                          ? "Money Given"
                          : "Money Received"
                      }

                    </p>

                    <p
                      class="text-xs text-slate-500 mt-1">

                      ${escapeHTML(
                        transaction.date ||
                        ""
                      )}

                    </p>

                  </div>


                  <p
                    class="font-bold
                           ${
                             given
                               ? "text-red-600"
                               : "text-emerald-600"
                           }">

                    ${formatCurrency(
                      transaction.amount
                    )}

                  </p>

                </div>


                ${
                  transaction.note
                    ? `
                      <p
                        class="text-sm
                               text-slate-500
                               mt-3">

                        ${escapeHTML(
                          transaction.note
                        )}

                      </p>
                    `
                    : ""
                }

              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ============================================================
// UPDATE SELECT BOXES
// ============================================================

function updatePersonSelects() {

  const options =
    `
      <option value="">
        Select person
      </option>
    ` +
    people
      .map(
        person =>
          `
            <option value="${person.id}">

              ${escapeHTML(
                person.name
              )}

            </option>
          `
      )
      .join("");


  if (
    $("transactionPerson")
  ) {

    $("transactionPerson").innerHTML =
      options;

  }


  if (
    $("reportPersonSelect")
  ) {

    $("reportPersonSelect").innerHTML =
      options;

  }

}


window.updatePersonSelects =
  updatePersonSelects;


// ============================================================
// PDF REPORT
// ============================================================

async function generatePDF(
  personId = null
) {

  try {

    showToast(
      "Preparing PDF..."
    );


    const module =
      await import(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.es.min.js"
      );


    const jsPDF =
      module.jsPDF;


    const pdf =
      new jsPDF();


    const person =
      personId
        ? people.find(
            p => p.id === personId
          )
        : null;


    const reportTransactions =
      personId
        ? transactions.filter(
            tx =>
              tx.personId ===
              personId
          )
        : transactions;


    const title =
      person
        ? `${person.name} - Account Statement`
        : "Full Ledger Statement";


    let given = 0;

    let received = 0;


    for (
      const transaction
      of reportTransactions
    ) {

      if (
        transaction.type ===
        "given"
      ) {

        given +=
          Number(
            transaction.amount || 0
          );

      }


      if (
        transaction.type ===
        "received"
      ) {

        received +=
          Number(
            transaction.amount || 0
          );

      }

    }


    pdf.setFontSize(18);

    pdf.text(
      "Transaction Paper",
      20,
      20
    );


    pdf.setFontSize(12);

    pdf.text(
      title,
      20,
      30
    );


    pdf.setFontSize(10);

    pdf.text(
      `Total Given: ${formatCurrency(given)}`,
      20,
      40
    );


    pdf.text(
      `Total Received: ${formatCurrency(received)}`,
      20,
      47
    );


    pdf.text(
      `Balance: ${formatCurrency(given - received)}`,
      20,
      54
    );


    let y = 68;


    pdf.setFont(
      undefined,
      "bold"
    );


    pdf.text(
      "Date",
      20,
      y
    );


    pdf.text(
      "Person",
      55,
      y
    );


    pdf.text(
      "Type",
      110,
      y
    );


    pdf.text(
      "Amount",
      145,
      y
    );


    pdf.setFont(
      undefined,
      "normal"
    );


    y += 7;


    for (
      const transaction
      of reportTransactions
    ) {

      if (
        y > 275
      ) {

        pdf.addPage();

        y = 20;

      }


      pdf.text(
        String(
          transaction.date || ""
        ).slice(
          0,
          10
        ),
        20,
        y
      );


      pdf.text(
        String(
          transaction.personName ||
          ""
        ).slice(
          0,
          22
        ),
        55,
        y
      );


      pdf.text(
        transaction.type ===
          "given"
          ? "Given"
          : "Received",
        110,
        y
      );


      pdf.text(
        formatCurrency(
          transaction.amount
        ),
        145,
        y
      );


      y += 7;

    }


    const filename =
      person
        ? `transaction-paper-${(
            person.name ||
            "account"
          )
            .replace(
              /[^a-z0-9]+/gi,
              "-"
            )
            .toLowerCase()}.pdf`
        : "transaction-paper-full-statement.pdf";


    pdf.save(
      filename
    );


    showToast(
      "PDF downloaded."
    );


  } catch (error) {

    console.error(
      "PDF error:",
      error
    );


    showToast(
      "PDF could not be generated."
    );

  }

}


// ============================================================
// PDF BUTTONS
// ============================================================

$("downloadFullReport")
  ?.addEventListener(
    "click",
    () => {

      generatePDF();

    }
  );


$("downloadPersonReport")
  ?.addEventListener(
    "click",
    () => {

      const personId =
        $("reportPersonSelect")
          ?.value || "";


      if (!personId) {

        showToast(
          "Please select a person."
        );

        return;

      }


      generatePDF(
        personId
      );

    }
  );


// ============================================================
// SEARCH / FILTER
// ============================================================

$("personSearch")
  ?.addEventListener(
    "input",
    renderDashboardPeople
  );


$("peoplePageSearch")
  ?.addEventListener(
    "input",
    renderPeople
  );


$("statusFilter")
  ?.addEventListener(
    "change",
    renderPeople
  );


$("sortPeople")
  ?.addEventListener(
    "change",
    renderPeople
  );


$("transactionSearch")
  ?.addEventListener(
    "input",
    renderTransactions
  );


// ============================================================
// GLOBAL VIEW UPDATE
// ============================================================

function updateAllViews() {

  updateDashboard();

  renderDashboardPeople();

  renderPeople();

  renderTransactions();

  updatePersonSelects();

}


// ============================================================
// INITIAL DATE
// ============================================================

if (
  $("transactionDate")
) {

  $("transactionDate").value =
    todayISO();

}


// ============================================================
// ERROR LOGGING
// ============================================================

window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(
      "Unhandled promise rejection:",
      event.reason
    );

  }
);


console.log(
  "Transaction Paper initialized successfully."
);
