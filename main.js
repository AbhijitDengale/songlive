import express from 'express'
import { spawn } from 'child_process'
import fs from 'fs';
import path from 'path';

const server = express()
// Directly set the stream key
const streamkey = 'wk7s-yxz0-ama6-amsm-8ygh';

// Generate array of video files from 1 to 121
const videoFiles = Array.from({ length: 121 }, (_, i) => `${i + 1}.mp4`);
let currentVideoIndex = 0;

// Function to check if video file exists
function videoExists(filename) {
    return fs.existsSync(path.join(process.cwd(), filename));
}

// Function to check if ffmpeg is installed
async function checkFFmpeg() {
    try {
        const child = spawn('ffmpeg', ['-version']);
        return new Promise((resolve) => {
            child.on('error', () => resolve(false));
            child.on('close', (code) => resolve(code === 0));
        });
    } catch (error) {
        return false;
    }
}

// Function to get next available video
function getNextVideo() {
    let attempts = 0;
    while (attempts < videoFiles.length) {
        const videoFile = videoFiles[currentVideoIndex];
        currentVideoIndex = (currentVideoIndex + 1) % videoFiles.length;
        
        if (videoExists(videoFile)) {
            console.log(`Switching to video: ${videoFile}`);
            return videoFile;
        }
        attempts++;
    }
    throw new Error('No valid video files found');
}

// Function to create FFmpeg command for a video
function createFFmpegCommand(videoFile) {
    return [
        'ffmpeg',
        '-re',
        '-i', videoFile,
        '-vcodec', 'libx264',
        '-pix_fmt', 'yuvj420p',
        '-maxrate', '2048k',
        '-preset', 'ultrafast',
        '-r', '12',
        '-framerate', '1',
        '-g', '50',
        '-crf', '51',
        '-strict', 'experimental',
        '-video_track_timescale', '100',
        '-b:v', '1500k',
        '-f', 'flv',
        `rtmp://a.rtmp.youtube.com/live2/${streamkey}`
    ];
}

// Function to start streaming
async function startStreaming() {
    try {
        // Check if FFmpeg is available
        const ffmpegAvailable = await checkFFmpeg();
        if (!ffmpegAvailable) {
            console.error('FFmpeg is not installed. Please install FFmpeg first.');
            process.exit(1);
        }

        const videoFile = getNextVideo();
        const ffmpegCommand = createFFmpegCommand(videoFile);
        
        console.log(`Starting stream with video: ${videoFile}`);
        const child = spawn(ffmpegCommand[0], ffmpegCommand.slice(1));

        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            console.log(`Video ${videoFile} finished with code ${code}`);
            // Start next video when current one ends
            setTimeout(startStreaming, 1000);
        });

        child.on('error', (err) => {
            console.error(`Child process error: ${err}`);
            // Attempt to restart on error
            setTimeout(startStreaming, 5000);
        });

    } catch (error) {
        console.error(`Streaming error: ${error.message}`);
        // Attempt to restart on error
        setTimeout(startStreaming, 5000);
    }
}

// Initialize streaming
startStreaming();

// Setup express server
server.get('/', (req, res) => {
    res.send('Your Live Streaming Is Running - Multiple Videos in Loop')
})

server.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Live stream server is ready on port ${PORT}`)
})
