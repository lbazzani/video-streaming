# video-streaming


## Avviare l'immagine docker
docker build -t video-streaming-server .

docker run -p 3000:3000 --env-file .env -v /Users/lorenzo/temp:/videos video-streaming-server

