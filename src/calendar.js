const calendar = document.getElementById("calendar");

// Basic demo calendar: 30 days
for (let i = 1; i <= 30; i++) {
  const day = document.createElement("div");
  day.classList.add("day");
  day.textContent = i;
  day.addEventListener("click", () => {
    day.classList.toggle("active");
  });
  calendar.appendChild(day);
}