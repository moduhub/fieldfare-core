<div id="top"></div>
<!--
*** Thanks for checking out the Best-README-Template. If you have a suggestion
*** that would make this better, please fork the repo and create a pull request
*** or simply open an issue with the tag "enhancement".
*** Don't forget to give the project a star!
*** Thanks again! Now go create something AMAZING! :D
-->



<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/moduhub/fieldfare">
    <img src="doc/images/logo.png" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">Fieldfare</h3>

  <p align="center">
    A backend framework for distributed networks
    <br />
    <a href="https://github.com/moduhub/fieldfare"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/moduhub/fieldfare">View Demo</a>
    ·
    <a href="https://github.com/moduhub/fieldfare/issues">Report Bug</a>
    ·
    <a href="https://github.com/moduhub/fieldfare/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

[![Product Name Screen Shot][product-screenshot]](https://example.com)

We have built a framework to solve some of our problems with data property. Depending on big datacenters, paying for DNS and fixed IPs to store your data is not fair, but micro datacenters like the ones small businesses can have are just not stable enough for any serious task. But using many microdatacenters spread in more than one location could solve the problem, provided that they can share information between them efficiently in real time.

Fieldfare is a library that uses Distributed Hash Tables to store data in a way that cannot be corrupted by malicious nodes, and Version Control to manager users, network configuration and services definitions. This way, no central authority is necessary, since anyone in teh "admins" group can commit changes to the environment, that are replicated by all the other participants.

<p align="right">(<a href="#top">back to top</a>)</p>



### Built With

* [Node.js](https://nodejs.org/)


<p align="right">(<a href="#top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

This is an example of how you may give instructions on setting up your project locally.
To get a local copy up and running follow these simple example steps.

### Prerequisites

Install the library via npm
* npm
  ```sh
  npm install fieldfare
  ```

### Setup

In your code, import ffinit accordng to the platform you are using:

If you are using Node.js, you can import like this:
```js
import {ffinit} from 'fieldfare/node';
```
This will also implement a WebSocket Server and a UDP Transceiver, please check the section about Webports to learn how to define the ports where the server will listen.

Or, if you are building for the browser, please do the following:

```js
import {ffinit} from 'fieldfare/browser';
```
This will implement a WebSocket client Transceiver only, that cannot receive incomming connections.

Define a UUID in string format to uniquely identify your data environment, that must be the same for all participants:
```js
const envUUID = '3481b164-58ac-4c68-8d9a-7e3c85839ca5';
```
Warning: please dont use this UUID, it was generated randmnly for this example only. You can generate a random UUID in any online service (https://www.uuidgenerator.net/version4) or user a library like

```sh
npm i uuid:
```

Now you can initilize the LocalHost and Environment, your data will be stored ina LevelDB instance if you are running on Node, or on IndexedDb if your are building for the browser;

```js
var env;

try {
  ffinit.setupLocalHost();
  ffinit.setEnvironmentUUID(envUUID);
  env = ffinit.setupEnvironment();
} catch (error) {
    console.error('Fieldfare Initialization failed: ' + error);
}
```

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

Use this space to show useful examples of how a project can be used. Additional screenshots, code examples and demos work well in this space. You may also link to more resources.

_For more examples, please refer to the [Documentation](https://example.com)_

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [ ] B-Tree Removal
- [ ] Routing
- [ ] Planning

See the [open issues](https://github.com/moduhub/fieldfare/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Adan Kvitschal - adan@moduhub.com

Project Link: [https://github.com/moduhub/fieldfare](https://github.com/moduhub/fieldfare)

<p align="right">(<a href="#top">back to top</a>)</p>


<!-- ACKNOWLEDGMENTS -->
## Acknowledgments

* []()
* []()
* []()

<p align="right">(<a href="#top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/moduhub/fieldfare.svg?style=for-the-badge
[contributors-url]: https://github.com/moduhub/fieldfare/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/moduhub/fieldfare.svg?style=for-the-badge
[forks-url]: https://github.com/moduhub/fieldfare/network/members
[stars-shield]: https://img.shields.io/github/stars/moduhub/fieldfare.svg?style=for-the-badge
[stars-url]: https://github.com/moduhub/fieldfare/stargazers
[issues-shield]: https://img.shields.io/github/issues/moduhub/fieldfare.svg?style=for-the-badge
[issues-url]: https://github.com/moduhub/fieldfare/issues
[license-shield]: https://img.shields.io/github/license/moduhub/fieldfare.svg?style=for-the-badge
[license-url]: https://github.com/moduhub/fieldfare/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/adan-kvitschal-ba771b177
[product-screenshot]: images/screenshot.png
