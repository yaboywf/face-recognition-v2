let knownFaces = [];
let stream = null;

// Function to load known faces from the JSON file
async function loadKnownFaces() {
    const res = await fetch('/face-recognition-v2/faces.json');
    const data = await res.json();
    console.log(data);

    knownFaces = data.map(user => ({
        name: user.name,
        descriptor: new Float32Array(user.descriptor)
    }));
}

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');

let initialNoseX = null;
let challengePassed = false;

// Function to find the best match for the detected face descriptor
function findBestMatch(descriptor) {
    let best = { name: "Unknown", distance: 1.0 }; // Set the initial best match to Unknown with max possible distance (1.0)
    for (const user of knownFaces) {
        const dist = faceapi.euclideanDistance(descriptor, user.descriptor);
        if (dist < best.distance && dist < 0.2) {
            best = { name: user.name, distance: dist };
        }
    }
    return best;
}

// Load the models before the button is clicked
async function loadModels() {
    let modelsPath;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Running locally
        modelsPath = '/models';
    } else {
        // Running on GitHub or other hosting
        modelsPath = '/face-recognition-v2/models';
    }

    // Load the models dynamically
    Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelsPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelsPath)
    ]).then(() => {
        console.log("All models loaded successfully!");
    }).catch((err) => {
        console.error("Error loading models: ", err);
    });

    document.getElementById('status').textContent = 'Models loaded successfully.';
    await loadKnownFaces(); // Load known faces after models are loaded
}

// Start the face matching process
async function start() {
    const status = document.getElementById('status');
    status.textContent = 'Starting camera...';
    stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;

    // When the video starts playing, begin face detection and matching
    video.addEventListener('play', () => {
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(overlay, displaySize);
        let matches = []

        const interval = setInterval(async () => {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            ctx.clearRect(0, 0, overlay.width, overlay.height);

            if (!detection) {
                status.textContent = `No face detected. Waiting...`;
                return;
            }

            const match = findBestMatch(detection.descriptor);

            if (match.name !== "Unknown") {
                matches.push(match.name)
                const allSame = matches.every((match) => match === matches[0]);

                if (allSame && matches.length > 3) {
                    status.textContent = `Hello ${match.name}`;
                    clearInterval(interval);
                }
            }
        }, 300);
    });
}

function stop() {
    const status = document.getElementById('status');
    status.textContent = "Video stopped.";

    // Pause the video and stop the stream
    video.pause();
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop()); // Stop all video tracks
        video.srcObject = null;
    }
}

// Load the models and known faces on page load
window.onload = async () => {
    await loadModels();
    document.getElementById('startBtn').addEventListener('click', start);
};

// Function to handle the button click event
document.getElementById('stop').addEventListener('click', stop);