fetch('https://reach-inbox-scheduler-nine.vercel.app/')
  .then(r => r.text())
  .then(html => {
    const scripts = [...html.matchAll(/<script type="module" crossorigin src="(.*?)">/g)].map(m => m[1]);
    for (const src of scripts) {
      fetch('https://reach-inbox-scheduler-nine.vercel.app' + src)
        .then(r => r.text())
        .then(js => {
          if (js.includes('auth/google')) {
            console.log('Found auth/google code:');
            const snippet = js.substring(js.indexOf('auth/google') - 50, js.indexOf('auth/google') + 50);
            console.log(snippet);
          }
        });
    }
  });
