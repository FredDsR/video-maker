const robots = {
    state: require('./robots/state.js'),
    input: require('./robots/input.js'),
    text: require('./robots/text.js')
}

async function start() {
    robots.input()

    await robots.text()

    const content = robots.state.load()
    console.dir(content, { depth: null })
}

start()