fetch('https://reach-inbox-scheduler-nine.vercel.app/')
  .then(r => r.text())
  .then(html => {
    const scripts = [...html.matchAll(/<script type="module" crossorigin src="(.*?)">/g)].map(m => m[1]);
    for (const src of scripts) {
      fetch('https://reach-inbox-scheduler-nine.vercel.app' + src)
        .then(r => r.text())
        .then(js => {
          const match = js.match(/baseURL:.*?withCredentials:!0/);
          if (match) {
            console.log('Found apiClient definition:');
            console.log(match[0]);
          }
        });
    }
  });
