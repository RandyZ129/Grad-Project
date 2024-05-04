let audioContext = null;
let toneNode;

let whiteGainNode, toneGainNode, chatterGainNode, musicGainNode;
let toneInput, musicGainInput, musicInput;

let musicSource, chatterSource;
let toneAnalyzer, whiteAnalyzer, chatterAnalyzer, bgBufferLength, bgFreqArray, bgAmplitudes;
let musAnalyzer, musBufferLength, musFreqArray, musAmplitudes;

let musicAmps, musicData, bgData;

async function createWhiteNoiseProcessor() {
    let processorNode = new AudioWorkletNode(audioContext, "white-noise");
    await audioContext.resume();
    return processorNode;
}

async function createMusicProcessor() {
    let processorNode = new AudioWorkletNode(audioContext, "music");
    await audioContext.resume();
    return processorNode;
}

async function start(event) {
    if (audioContext) {
        await audioContext.close();
        audioContext = null;
    } else {
        audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule("sounds.js");
        await createToneAnalyzer();
        await createWhiteAnalyzer();
        await createChatterAnalyzer();
        await createMusicAnalyzer();
        await createWhiteNoise();
        await createTone();
        await createChatter();
        await createMusic(musicInput.value);

        musAmplitudes = [];

        for (let i = 0; i < 50; i++) {
            musAmplitudes.push(0);
        }

        musAmplitudes[49] = 1;

        bgAmplitudes = [];

        for (let i = 0; i < 50; i++) {
            bgAmplitudes.push(0);
        }

        musicData = [];
        bgData = [];

        musicAmps = new CanvasJS.Chart("music-amps", {
            title: {
                text: "Live Volumes"
            },
            data: [{
                type: "line",
                showInLegend: true,
                legendText: "Music volume (dB)",
                dataPoints: musicData,
                markerSize: 0,
            }, {
                type: "line",
                showInLegend: true,
                legendText: "Background noise volume (dB)",
                dataPoints: bgData,
                markerSize: 0,
            }],
        });

        window.setInterval(sampleRMS, 100);
    }
}

async function createToneAnalyzer() {
    toneAnalyzer = audioContext.createAnalyser();
    toneAnalyzer.fftSize = 2048;
    bgBufferLength = toneAnalyzer.frequencyBinCount;
    bgFreqArray = new Float32Array(bgBufferLength);
}

async function createWhiteAnalyzer() {
    whiteAnalyzer = audioContext.createAnalyser();
    whiteAnalyzer.fftSize = 2048;
    bgBufferLength = whiteAnalyzer.frequencyBinCount;
    bgFreqArray = new Float32Array(bgBufferLength);
}

async function createChatterAnalyzer() {
    chatterAnalyzer = audioContext.createAnalyser();
    chatterAnalyzer.fftSize = 2048;
    bgBufferLength = chatterAnalyzer.frequencyBinCount;
    bgFreqArray = new Float32Array(bgBufferLength);
}

async function createMusicAnalyzer() {
    musAnalyzer = audioContext.createAnalyser();
    musAnalyzer.fftSize = 2048;
    musBufferLength = musAnalyzer.frequencyBinCount;
    musFreqArray = new Float32Array(musBufferLength);
}

async function createWhiteNoise() {
    let whiteNoiseNode = await createWhiteNoiseProcessor();
    let whiteNoiseSource = new OscillatorNode(audioContext);
    whiteGainNode = audioContext.createGain();
    whiteGainNode.gain.setValueAtTime(0, audioContext.currentTime);

    whiteNoiseSource.type = "square";
    whiteNoiseSource.frequency.setValueAtTime(440, audioContext.currentTime);
    whiteNoiseSource.connect(whiteNoiseNode).connect(whiteGainNode).connect(whiteAnalyzer).connect(audioContext.destination);
    whiteNoiseSource.start();
}

async function createTone() {
    toneNode = await createMusicProcessor();
    toneNode = new OscillatorNode(audioContext);
    toneGainNode = audioContext.createGain();
    toneGainNode.gain.setValueAtTime(0, audioContext.currentTime);

    toneNode.type = "sine";
    toneNode.frequency.setValueAtTime(440, audioContext.currentTime);
    toneNode.connect(toneGainNode).connect(toneAnalyzer).connect(audioContext.destination);
    toneNode.start();
}

async function createChatter() {
    chatterSource = new Audio("chatter.wav");
    chatterSource.loop = true;
    chatterGainNode = audioContext.createGain();
    chatterGainNode.gain.setValueAtTime(0, audioContext.currentTime);

    let source = audioContext.createMediaElementSource(chatterSource);
    source.connect(chatterGainNode).connect(chatterAnalyzer).connect(audioContext.destination);

    chatterSource.play();
}

async function createMusic(fileName) {
    if (musicSource) {
        musicSource.pause();
    }
    
    musicSource = new Audio(fileName);
    musicSource.loop = true;
    musicGainNode = audioContext.createGain();
    musicGainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    let source = audioContext.createMediaElementSource(musicSource);
    source.connect(musicGainNode).connect(musAnalyzer).connect(audioContext.destination);

    musicSource.play();
}

window.addEventListener("load", () => {
    toneInput = document.getElementById("tone-tones");
    toneInput.onchange = updateTone;

    musicGainInput = document.getElementById("music-gain");

    musicInput = document.getElementById("music-options");
    musicInput.oninput = updateMusicChoice;
});

function sampleRMS() {
    let musWindowSize = document.getElementById("mus-avg-window").value;
    let bgWindowSize = document.getElementById("bg-avg-window").value;

    musAmplitudes.shift();
    musAnalyzer.getFloatTimeDomainData(musFreqArray);
    musAmplitudes.push(computeRMS(musFreqArray));

    let musTotal = 0;
    for (let i = 0; i < musWindowSize; i++) {
        musTotal += musAmplitudes[musAmplitudes.length - i - 1];
    }
    musTotal /= musWindowSize;

    let compFactor;

    if (toneGainNode.gain.value > 0) {
        toneAnalyzer.getFloatTimeDomainData(bgFreqArray);
        compFactor = 1;
    } else if (whiteGainNode.gain.value > 0) {
        whiteAnalyzer.getFloatTimeDomainData(bgFreqArray);
        compFactor = 10;
    } else {
        chatterAnalyzer.getFloatTimeDomainData(bgFreqArray);
        compFactor = 20;
    }

    let bgAmplitude = computeRMS(bgFreqArray) * compFactor;
    bgAmplitudes.shift()
    bgAmplitudes.push(bgAmplitude);

    let bgTotal = 0;
    for (let i = 0; i < bgWindowSize; i++) {
        bgTotal += bgAmplitudes[bgAmplitudes.length - i - 1];
    }
    bgTotal /= bgWindowSize;

    let val = parseFloat(Math.max(bgTotal / musTotal, musicGainInput.value));

    if (isFinite(val)) {
        musicGainNode.gain.setValueAtTime(val, audioContext.currentTime);
    }

    if (musicData.length >= 50) {
        musicData.shift();
    }

    if (bgData.length >= 50) {
        bgData.shift();
    }

    musicData.push({x: audioContext.currentTime, y: toDecibel(musTotal)});
    bgData.push({x: audioContext.currentTime, y: toDecibel(bgTotal / compFactor)});
    musicAmps.render();
}

function updateWhiteNoiseGain(event) {
    if (audioContext) {
        whiteGainNode.gain.setValueAtTime(event.target.value / 10, audioContext.currentTime);
        document.getElementById("white-gain-text").innerHTML = `<label for="white-noise-gain">White noise volume<br>(${Math.round(event.target.value * 100)}%)</label>`;
    }
}

function updateToneGain(event) {
    if (audioContext) {
        toneGainNode.gain.setValueAtTime(event.target.value / 2, audioContext.currentTime);      
        document.getElementById("tone-gain-text").innerHTML = `<label for="tone-gain">Tone volume<br>(${Math.round(event.target.value * 100)}%)</label>`;
    }
}

function updateTonePitch(event) {
    if (audioContext) {
        toneNode.frequency.setValueAtTime(440 * Math.pow(2, (event.target.value - 48) / 12), audioContext.currentTime);
        document.getElementById("tone-pitch-text").innerHTML = `<label for="tone-pitch">Tone pitch<br>(${stepToName(event.target.value)})</label>`;
    }
}

function updateTone(event) {
    if (audioContext) {
        toneNode.type = event.target.value;
    }
}

function updateChatterGain(event) {
    if (audioContext) {
        chatterGainNode.gain.setValueAtTime(event.target.value / 2, audioContext.currentTime);      
        document.getElementById("chatter-gain-text").innerHTML = `<label for="chatter-gain">Chatter volume<br>(${Math.round(event.target.value * 100)}%)</label>`;
    }
}

function updateMusicGain(event) {
    if (audioContext) {
        document.getElementById("music-gain-text").innerHTML = `<label for="music-gain">Min music volume<br>(${Math.round(event.target.value * 100)}%)</label>`;
    }
}

function updateMusicChoice(event) {
    if (audioContext) {
        createMusic(event.target.value);
    }
}

function updateBgAveragingSize(event) {
    if (audioContext) {
        document.getElementById("bg-avg-size-text").innerHTML = `<label for="bg-avg-window">Background averaging size<br>(${event.target.value})</label>`;
    }
}

function updateMusAveragingSize(event) {
    if (audioContext) {
        document.getElementById("mus-avg-size-text").innerHTML = `<label for="mus-avg-window">Music averaging size<br>(${event.target.value})</label>`;
    }
}

function computeRMS(freqArray) {
    let total = 0;
    for (let i = 0; i < freqArray.length; i++) {
        total += Math.pow(freqArray[i], 2);
    }
    return Math.pow(total / freqArray.length, 0.5);
}

function toDecibel(rms) {
    if (rms === 0) {
        return -70;
    }
    return 20 * Math.log10(rms);
}

function stepToName(step) {
    console.log(Math.floor((step + 8) / 12));
    return ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"][step % 12] + "" + Math.floor((+step + 9) / 12);
}
