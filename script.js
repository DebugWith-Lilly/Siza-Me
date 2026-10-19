function updateTime() {
    const now = new Date();

    const time = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });

    document.getElementById("time").textContent = time;
}

updateTime();
setInterval(updateTime, 1000);
