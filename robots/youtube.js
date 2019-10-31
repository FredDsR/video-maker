const express = require('express')
const google = require('googleapis').google
const youtube = google.youtube({ version: 'v3' })
const OAuth2 = google.auth.OAuth2
const fs = require('fs')

const state = require('./state.js')

async function robot() {
    const content = state.load()

    await authenticateWithOAuth()
    const videoInformation = await uploadVideo(content)
    await uploadThumbnail(videoInformation)

    async function authenticateWithOAuth() {
        console.log(`> [youtube-robot] Starting...`)

        const webServer = await startWebServer()
        const OAuthClient = await createOAuthClient()
        requestUserConsent(OAuthClient)
        const authorizationToken = await waitForGoogleCallback(webServer)
        await requestGoogleForAccessTokens(OAuthClient, authorizationToken)
        setGlobalGoogleAuthentication(OAuthClient)
        await stopWebServer(webServer)

        async function startWebServer() {
            return new Promise((resolve, reject) => {
                const port = 5000
                const app = express()

                const server = app.listen(port, () => {
                    console.log(`> [youtube-robot] Listening on http://localhost:${port}`)

                    resolve({
                        app,
                        server
                    })
                })
            })
        }

        async function createOAuthClient() {
            const OAuthClient = new OAuth2(
                process.env.YT_CLIENT_ID,
                process.env.YT_CLIENT_SECRET,
                process.env.YT_REDIRECT_URIS
            )
        
            return OAuthClient
        }

        function requestUserConsent(OAuthClient) {
            const consentUrl = OAuthClient.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/youtube']
            })

            console.log(`> [youtube-robot] Please give your consent ${consentUrl}`)
        }

        async function waitForGoogleCallback(webServer) {
            return new Promise((resolve, reject) => {
                console.log('> [youtube-robot] Waiting for user consent...')

                webServer.app.get('/oauth2callback', (req, res) => {
                    const authCode = req.query.code
                    console.log(`> [youtube-robot] Consent given: ${authCode}`)

                    res.send('<h1>Thank you!</h1><p>Now close this tab.</p>')
                    resolve(authCode)
                })
            })
        }

        async function requestGoogleForAccessTokens(OAuthClient, authorizationToken) {
            return new Promise((resolve, reject) => {
                OAuthClient.getToken(authorizationToken, (err, tokens) => {
                    if (err) {
                        return reject(err)
                    }

                    console.log('> [youtube-robot] Access tokens received:')
                    console.log(tokens)

                    OAuthClient.setCredentials(tokens)
                    resolve()
                })
            })
        }

        async function setGlobalGoogleAuthentication(OAuthClient) {
            google.options({
                auth: OAuthClient
            })
        }

        async function stopWebServer(webServer){
            return new Promise((resolve, reject) => {
                webServer.server.close(() => {
                    resolve()
                })
            })
        }
    }

    async function uploadVideo(content) {
        const videoFilePath = './content/video.mp4'
        const videoFileSize = fs.statSync(videoFilePath).size
        const videoTitle = `${content.prefix} ${content.searchTerm}`
        const videoTags = [content.searchTerm, ...content.sentences[0].keywords]
        const videoDescription = content.sentences.map(sentence => sentence.text).join('\n\n')

        const requestParams = {
            part: 'snippet, status',
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    tags: videoTags
                },
                status: {
                    privacyStatus: 'unlisted'
                }
            },
            media: {
                body: fs.createReadStream(videoFilePath)
            }
        }

        const youtubeResponse = await youtube.videos.insert(requestParams, {
            onUploadProgress: onUploadProgress
        })

        console.log(`> [youtube-robot] Video available at: https://youtu.be/${youtubeResponse.data.id}`)

        return youtubeResponse.data
        
        function onUploadProgress(event) {
            const progress = Math.round((event.bytesRead / videoFileSize) * 100)
            console.log(`> [youtube-robot] ${progress}% completed`)
        }
    }

    async function uploadThumbnail(videoInformation) {
        const videoId = videoInformation.id
        const videoThumbnailFilePath = './content/youtube-thumbnail.jpg'
        
        const requestParams = {
            videoId: videoId,
            media: {
                mimeType: 'image/jpeg',
                body: fs.createReadStream(videoThumbnailFilePath)
            }
        }

        await youtube.thumbnails.set(requestParams)
        console.log('> [youtube-robot] Thumbnail uploaded!')
    }
}

module.exports = robot