import { record } from 'node-record-lpcm16';
import WebSocket from 'ws';
import { PhoneConvo, summarise, speak } from './responder';
import { start, appointments } from './web-interface';

process.env.PULSE_SINK = "oracle_playback"
process.env.PULSE_SOURCE = "oracle_capture"

let currently_responding = false;

let detect_last_ms = 200;
let detected_now = false;
let detected_flag = false;
let detected_last = 0;

let transcription = [];

let currentConvo = null;

process.on('SIGALRM', () => {
  console.log("**** SIGALRM");
  if(currentConvo)
  {
    let convo = currentConvo;
    convo.endTime = Date.now();
    currentConvo = null;
    transcription = [];
  
    summarise(convo.log, summary => {
      convo.summary = summary.message.content;
      console.log(`SUMMARY: ${summary}`);
      appointments.find({ status: "in progress" }).then(rows => {
        if (rows.length > 0) {
          rows[0].status = "completed";
          rows[0].transcript = convo;
          rows[0].save().catch((err) => console.log(err));
        }
      });
    }, error => {
      console.log(error);
    });
  }
});

start();

var establishConnection = function () {
  const socket: WebSocket = new WebSocket('wss://api.deepgram.com/v1/listen', {
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_TOKEN}`,
    },
  });

  socket.onopen = (m) => {
    const micStream = record({
      sampleRate: 44100,
      channels: 1,
      verbose: false,
      threshold: 0
    });

    micStream.stream().on('data', function (chunk) {
      socket.send(chunk);
      detected_now = !isSilent(chunk, -40);

      if (detected_now) {
        detected_flag = true;
        detected_last = Date.now();
      } else {
        if (Date.now() - detected_last < detect_last_ms) {
          detected_flag = true
        } else {
          detected_flag = false;

          if (transcription.length > 0) {
            let speech = transcription.join(" ");

            console.log(`SPEECH: ${speech}`);

            getCurrentConvo(convo => {
              if (currently_responding == false) {
                currently_responding = true;
                convo.respond(speech, res => {
                  console.log(`RESPONSE: ${res.content}`);
                  speak(res.content);
                  currently_responding = false;
                });
                transcription = [];
              }
            });

          }
        }
      }
    });
  }

  socket.onclose = () => {
    console.log('Socket closed.')
    process.exit(1);
  }

  socket.onmessage = (message) => {
    let m = JSON.parse(message.data.toString())

    if (m.hasOwnProperty('channel')) {
      let words = m.channel.alternatives[0].transcript

      if (words.length > 0) {
        detected_flag = true;
        detected_last = Date.now();
        transcription.push(words);
      }
    }
  }
}

function getCurrentConvo(cb) {
  if (currentConvo != null)
    return cb(currentConvo);

  appointments.find({ status: "in progress" }).then(rows => {
    if (rows.length > 0) {
      let appt = rows[0];

      let appt_data = {
        NAME: appt.name,
        SERVICE: appt.service,
        TIME: appt.time,
        AVAILABILITY: appt.availability,
      };

      currentConvo = new PhoneConvo(appt_data);

      return cb(currentConvo);
    }
  });
}

function isSilent(buffer, threshold = -50) {
  const pcmData = new Int16Array(buffer.buffer);
  const amplitude = Math.max(...pcmData.map(Math.abs));
  const decibels = 20 * Math.log10(amplitude / 32768);
  return decibels < threshold;
}

establishConnection()
