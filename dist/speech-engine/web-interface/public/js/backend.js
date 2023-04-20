var appointments = [];
var callInProgress = false;

$(document).ready(function() {
    $('#appointments').DataTable({
        data: [],
        columns: [
            { data: '_id', visible: false },
            { data: 'name' },
            { data: 'business' },
            { data: 'phone' },
            { data: 'service' },
            { data: 'time' },
            { data: 'availability' },
            { data: 'status' },
            { data: 'summary' },
            { data: 'recording' },
            { data: 'action' },
        ],
        columnDefs: [
            {
                targets: -3, // -1 means the last column
                data: null, // Use null as the data source for this column
                render: function (data, type, row, meta) {
                    if(row.transcript && row.transcript.summary)
                        return `${row.transcript.summary} <a href="#" onclick="viewTranscript('${row._id}')">View Transcript</a>`;
                    else
                        return 'N/A';
                }
            },
            {
                targets: -2, // -1 means the last column
                data: null, // Use null as the data source for this column
                render: function (data, type, row, meta) {
                    if(row.status == "completed" && row.recording != "")
                        return `<audio controls><source src="/recordings/${row._id}.wav" type="audio/wav"></audio>`;
                    else
                        return 'N/A';
                }
            },
            {
                targets: -1, // -1 means the last column
                data: null, // Use null as the data source for this column
                render: function (data, type, row, meta) {
                    if(row.status == 'queued' || row.status == 'cancelled'){
                        return `<button class="ui-btn" onclick="doCall('${row._id}')" ${callInProgress?'disabled':''}>Call</button>`;;
                    } else if(row.status == 'in progress') {
                        return `<button class="ui-btn ui-btn-red" onclick="doHangup('${row._id}')">Hangup</button>`;
                    } else if(row.status == 'completed') {
                        buf = `<button class="ui-btn" onclick="doCall('${row._id}', true)" ${callInProgress?'disabled':''}>Call Again</button><br/>`;
                        buf += `<button class="ui-btn ui-btn-red" onclick="deleteAppointment('${row._id}')">Delete</button>`;
                        return buf;
                    } else {
                        return 'N/A';
                    }
                }
            }
        ],
        dom: 't' // Display only the table element
    });
    window.setInterval(() => {
        last_appointments = appointments;
        getAppointments(false, (appointments) => {
            if(JSON.stringify(last_appointments) != JSON.stringify(appointments))
                updateAppointments(appointments);
        });
    }, 1000);
    getAppointments(true);
});

function viewTranscript(id){
    $.ajax({
        url: '/api/appointments/' + id,
        type: 'GET',
        success: function(data) {
            console.log(data);
            let buf = document.createElement('table');
            buf.style.width='100%';
            data.transcript.log.forEach(message => {
                if(message.role != 'system'){
                    let row = document.createElement('tr');
                    let role = document.createElement('td');
                    let text = document.createElement('td');
                    row.style.backgroundColor = message.role == 'assistant' ? '#fefefe' : '#eeeeee';
                    role.innerHTML = message.role == 'assistant' ? 'Assistant' : 'Business';
                    text.innerHTML = message.content;
                    row.appendChild(role);
                    row.appendChild(text);
                    buf.appendChild(row);
                }
            });
            $('#transcript').html(buf);
            $('#transcript-dialog').show();
        }
    });
}

function doCall(id, exists){
    if(!exists || window.confirm('Are you sure you want to discard current information and call again?')){
        $.ajax({
            url: '/api/appointments/' + id + '/call',
            type: 'GET',
            success: function(data) {
                getAppointments(true);
            }
        });
    }
}

function doHangup(id){
    $.ajax({
        url: '/api/appointments/' + id + '/hangup',
        type: 'GET',
        success: function(data) {
            getAppointments(true);
        }
    });
}

function deleteAppointment(id){
    $.ajax({
        url: '/api/appointments/' + id,
        type: 'DELETE',
        success: function(data) {
            getAppointments(true);
        }
    });
}


function getAppointments(update, cb) {
    $.ajax({
        url: '/api/appointments',
        type: 'GET',
        success: function(data) {
            appointments = data;

            let _callInProgress = false;
            appointments.forEach(appt => {
                if(appt.status == 'in progress')
                    _callInProgress = true;
            });
            callInProgress = _callInProgress;

            if(update)
                updateAppointments(data);

            if(cb)
                cb(appointments);

        }
    });
}

function updateAppointments(rows){
    $('#appointments').DataTable().clear();
    $('#appointments').DataTable().rows.add(rows);
    $('#appointments').DataTable().draw();
}

function addAppointment() {

    var appointment = {
        name: document.getElementById("name").value,
        business: document.getElementById("business").value,
        phone: document.getElementById("phone").value,
        service: document.getElementById("service").value,
        time: document.getElementById("time").value,
        availability: document.getElementById("availability").value
    };

    $.ajax({
        url: '/api/appointments',
        type: 'POST',
        data: JSON.stringify(appointment),
        contentType: 'application/json',
        success: function(data) {
            getAppointments(true);

            $(':input','#appt-form')
                .not(':button, :submit, :reset, :hidden')
                .val('')
                .prop('checked', false)
                .prop('selected', false);

            $('#appointment-dialog').hide();
        }
    });

}