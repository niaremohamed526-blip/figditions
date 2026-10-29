# Architecture rules

- Sales writes use the browser client's session recovery helper; retry only explicit expired-JWT rejections, never uncertain failures, to avoid duplicate sales without privileged credentials.