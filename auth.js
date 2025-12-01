// Demo hardcoded user
const DEMO_USER = { username: "admin", password: "1234" };

// Login form (on index.html)
document.getElementById("loginForm")?.addEventListener("submit", function(e){
  e.preventDefault();
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value;

  if (u === DEMO_USER.username && p === DEMO_USER.password){
    localStorage.setItem("loggedIn", "true");
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("loginMsg").textContent = "Invalid credentials";
  }
});

// Logout button (on dashboard.html)
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("loggedIn");
  window.location.href = "index.html";
});

// Protect dashboard: if on dashboard and not logged in, redirect to login
if (window.location.pathname.includes("dashboard.html")){
  if (localStorage.getItem("loggedIn") !== "true"){
    window.location.href = "index.html";
  }
}
