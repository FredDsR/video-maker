const robots = {
    state: require('./robots/state.js'),
    input: require('./robots/input.js'),
    text: require('./robots/text.js'),
    image: require('./robots/image.js')
}

async function start() {
    robots.input()
    await robots.text()
    await robots.image()

    console.log(' >> The process is complete.')
    const content = robots.state.load()
    console.dir(content, { depth: null })
}

start()