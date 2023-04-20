import express from "express";
import fs from "fs";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import { exec } from "child_process";

mongoose.connect("mongodb://mongo:27017/duplex");

const schema = new mongoose.Schema({
    name: String,
    business: String,
    phone: String,
    service: String,
    time: String,
    availability: String,
    status: String,
    recording: String,
    transcript: Object
});

export const appointments = mongoose.model("appointments", schema);

export const start = (): void => {
    const app = express();
    app.use(bodyParser.json());

    process.on('SIGALRM', async () => {
      console.log("******** SIGALRM");
      stopRecording();
    });

    app.get('/api/appointments', async (req, res) => {
      appointments.find({}).then(rows => {
        res.json(rows);    
      })
      .catch(err => res.json(err));
    });

    app.get('/api/appointments/:id', async (req, res) => {
      appointments.findById(req.params.id).then(row => {
        res.json(row);
      })
      .catch(err => res.json(err));
    });

    app.delete('/api/appointments/:id', async (req, res) => {
      appointments.deleteOne({ _id: req.params.id }).then(row => {
        res.json(row);
      })
      .catch(err => res.json(err));
    });

    app.post('/api/appointments', async (req, res) => {
      const row = new appointments({
        name: req.body.name,
        business: req.body.business,
        phone: req.body.phone,
        service: req.body.service,
        time: req.body.time,
        availability: req.body.availability,
        status: 'queued',
        transcript: {},
      });
      row.save().then(row => {
        res.json(row);
      })
      .catch(err => {
        res.json(err);
      });
    });

    app.get('/api/appointments/:id/call', async (req, res) => {
      appointments.findById(req.params.id).then(row => {
        row.status = "in progress";
        row.transcript = {};
        row.recording = `${row._id}.wav`;
        row.save().then(row => {
          sendDial(row.phone);
          startRecording(row._id);
          res.json(row);
        })
        .catch(err => res.json(err));  
      })
      .catch(err => res.json(err));
    });

    app.get('/api/appointments/:id/hangup', async (req, res) => {
      appointments.findById(req.params.id).then(row => {
        row.status = "cancelled";
        row.recording = "";
        row.save().then(row => {
          sendHangup(row._id);
          stopRecording();
          res.json(row);
        })
        .catch(err => res.json(err));
      })
      .catch(err => res.json(err));
    });

    // Serve static files
    app.use("/", express.static(__dirname+"/public"));
    
    // Start the server
    const port = 3000;
    app.listen(port, () => {
      console.log(`Server started on port ${port}`);
    });
}

function sendDial(number){
  var fifo = fs.createWriteStream('/tmp/baresip.pipe');
  fifo.write(`/dial ${number}\n`);
}

function sendHangup(id){
  var fifo = fs.createWriteStream('/tmp/baresip.pipe');
  fifo.write(`/hangup\n`);
}

function startRecording(id){
  exec(`nohup /home/duplex/record.sh ${id} &`);
}

async function stopRecording(){
  exec('pkill -9 arecord');
}

