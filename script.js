document.addEventListener('DOMContentLoaded', () => {

    /* =====================================================
       TIMERS
    ===================================================== */
    const timers = {};

    document.querySelectorAll('.timer').forEach(timerEl => {
        const id = timerEl.dataset.timer;
        const display = timerEl.querySelector('.timer-display');
        const buttons = timerEl.querySelectorAll('button');
        const input = timerEl.querySelector('.duration-input');

        function sanitizeInput() {
            let val = parseInt(input.value);
            if (isNaN(val) || val < 5) val = 5;
            input.value = val;
            return val;
        }

        timers[id] = {
            seconds: sanitizeInput() * 60,
            interval: null,
            display,
            input
        };

        function render() {
            const sec = timers[id].seconds;
            const m = String(Math.floor(sec / 60)).padStart(2, '0');
            const s = String(sec % 60).padStart(2, '0');
            display.textContent = `${m}:${s}`;

            if (sec <= 5 * 60) {
                display.style.backgroundColor = 'orange';
                display.style.color = 'white';
                display.style.borderColor = 'orange';
            } else {
                display.style.backgroundColor = '#ecf7ec';
                display.style.color = '#1f3b1f';
                display.style.borderColor = 'var(--green)';
            }
        }

        function start() {
            if (timers[id].interval) return;
            if (timers[id].seconds <= 0) timers[id].seconds = sanitizeInput() * 60;

            timers[id].interval = setInterval(() => {
                if (timers[id].seconds > 0) {
                    timers[id].seconds--;
                    render();
                } else {
                    clearInterval(timers[id].interval);
                    timers[id].interval = null;
                    alert(`Timer ${id} terminé !`);
                }
            }, 1000);
        }

        function pause() {
            clearInterval(timers[id].interval);
            timers[id].interval = null;
        }

        function stop() {
            clearInterval(timers[id].interval);
            timers[id].interval = null;
            timers[id].seconds = sanitizeInput() * 60;
            render();
        }

        buttons.forEach(btn => {
            if (btn.classList.contains('startButton')) {
                btn.addEventListener('click', start);
            }
            if (btn.classList.contains('pauseButton')) {
                btn.addEventListener('click', pause);
            }
            if (btn.classList.contains('stopButton')) {
                btn.addEventListener('click', stop);
            }
        });

        input.addEventListener('change', () => {
            timers[id].seconds = sanitizeInput() * 60;
            render();
        });

        render();
    });

    /* =====================================================
       LOCAL STORAGE
    ===================================================== */
    const STORAGE_KEY = "calendar_reservations";

    function saveReservations(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    function loadReservations() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    }

    let reservations = loadReservations();
    let editingReservationId = null;


    /* =====================================================
       HORAIRES 1/4 D'HEURE
    ===================================================== */
    function populateTimeSelects() {
        const startSelect = document.getElementById('resStart');
        const endSelect = document.getElementById('resEnd');

        for (let h = 0; h <= 23; h++) {
            for (let m of [0, 15, 30, 45]) {
                const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                startSelect.add(new Option(time, time));
                endSelect.add(new Option(time, time));
            }
        }
    }
    populateTimeSelects();

    /* =====================================================
       CALENDRIER
    ===================================================== */
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        locale: 'fr',

        buttonText: {
            today: "Aujourd'hui",
            month: "Mois",
            week: "Semaine",
            day: "Jour"
        },
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        selectable: true,
        validRange: {
            start: new Date().toISOString().split('T')[0]
        },
        events: []
    });

    calendar.render();

    calendar.on('eventClick', info => {
        const event = info.event;

        const dialog = document.getElementById('reservationModal');
        dialog.dataset.date = event.startStr.split('T')[0];

        document.getElementById('resResource').value = event.title;
        document.getElementById('resStart').value = event.startStr.substring(11, 16);
        document.getElementById('resEnd').value = event.endStr.substring(11, 16);

        editingReservationId = event.id;
        document.getElementById('deleteReservationBtn').hidden = false;

        dialog.showModal();
    });


    reservations.forEach(r => {
        calendar.addEvent({
            id: r.id,
            title: r.resource,
            start: `${r.date}T${r.start}`,
            end: `${r.date}T${r.end}`
        });
    });

    /* =====================================================
       POPUP RÉSERVATION
    ===================================================== */
    function openReservationPopup(date) {
        editingReservationId = null;
        document.getElementById('deleteReservationBtn').hidden = true;
        const dialog = document.getElementById('reservationModal');
        dialog.dataset.date = date;
        dialog.showModal();
    }

    calendar.on('select', info => {
        openReservationPopup(info.startStr.split('T')[0]);
        calendar.unselect();
    });

    document.getElementById('cancelReservationBtn')
        .addEventListener('click', () => {
            editingReservationId = null;
            document.getElementById('deleteReservationBtn').hidden = true;
            document.getElementById('reservationModal').close();
        });


    document.getElementById('validateReservationBtn')
        .addEventListener('click', e => {
            e.preventDefault();

            const dialog = document.getElementById('reservationModal');
            const date = dialog.dataset.date;

            const resource = document.getElementById('resResource').value;
            const start = document.getElementById('resStart').value;
            const end = document.getElementById('resEnd').value;

            if (!resource || !start || !end || end <= start) {
                alert("Informations invalides");
                return;
            }

            if (editingReservationId) {
                // ✏️ MODIFICATION
                const index = reservations.findIndex(r => r.id == editingReservationId);
                if (index === -1) return;

                reservations[index] = {
                    id: editingReservationId,
                    date,
                    resource,
                    start,
                    end
                };

                saveReservations(reservations);

                const event = calendar.getEventById(editingReservationId);
                event.setProp('title', resource);
                event.setStart(`${date}T${start}`);
                event.setEnd(`${date}T${end}`);

            } else {
                // ➕ NOUVELLE RÉSERVATION
                const reservation = {
                    id: Date.now(),
                    date,
                    resource,
                    start,
                    end
                };

                reservations.push(reservation);
                saveReservations(reservations);

                calendar.addEvent({
                    id: reservation.id,
                    title: resource,
                    start: `${date}T${start}`,
                    end: `${date}T${end}`
                });
            }

            editingReservationId = null;
            dialog.close();
        });

    /* =====================================================
       SUPPRESSION D'UNE RÉSERVATION 
    ===================================================== */

    document.getElementById('deleteReservationBtn')
        .addEventListener('click', () => {

            if (!editingReservationId) return;

            if (!confirm("Supprimer cette réservation ?")) return;

            // Supprimer du tableau
            reservations = reservations.filter(r => r.id != editingReservationId);
            saveReservations(reservations);

            // Supprimer du calendrier
            const event = calendar.getEventById(editingReservationId);
            if (event) event.remove();

            editingReservationId = null;
            document.getElementById('deleteReservationBtn').hidden = true;
            document.getElementById('reservationModal').close();
        });




    /* =====================================================
       EXPORT / IMPORT SAUVEGARDE
    ===================================================== */
    function exportBackup() {
        const blob = new Blob(
            [JSON.stringify(reservations, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "reservations_backup.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    document.getElementById("exportBackupBtn")
        ?.addEventListener("click", exportBackup);

    document.getElementById("importBackupBtn")
        ?.addEventListener("click", () => {
            document.getElementById("importBackupInput").click();
        });

    document.getElementById("importBackupInput")
        ?.addEventListener("change", e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    if (!Array.isArray(data)) throw "invalid";

                    reservations = data;
                    saveReservations(reservations);

                    calendar.removeAllEvents();
                    reservations.forEach(r => {
                        calendar.addEvent({
                            id: r.id,
                            title: r.resource,
                            start: `${r.date}T${r.start}`,
                            end: `${r.date}T${r.end}`
                        });
                    });

                    alert("Sauvegarde importée");
                } catch {
                    alert("Fichier invalide");
                }
            };
            reader.readAsText(file);
        });

});
