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
[![ISC License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/moduhub/fieldfare">
    <img src="doc/images/logo.svg" alt="Logo" width="80" height="80">
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

### Main Concepts

#### Resources

Resource is the name given to any chunk of data that is used inside the enviroment. All resources are identified by the hash of their content. This way they can be stored anywhere and retrieved from any potentially malicious source withou the fear of data corruption.

#### Local Host

Any instance running Fieldfare must implement a Local Host to be able to talk to the network. A host is basically a store for a key pair that is used to sign every message generate locally. Another use of the key pair is for unique identification: every host is identified by the hash of their public key in JWK format.

#### Environment

The environment is an object that is kept under version control and is identified by an UUID, it can be edited by anyone that is under the "admins" group. Valid changs include adding other admins and removing itself, or editing any property of the environment (except its UUID).

The basic properties of the enviorment are its Services and lists of providers of eac service. Also there is a list of webports, that wll be explained ahead.

#### Services

TODO

#### Webports

TODO

### Built With

* [Node.js](https://nodejs.org/)

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

Fieldfare can be used in two ways: it can run standalone using the CLI tools or you can integrate it to a larger project. Standalone services are useful to manage data and workload in the backend. When you are integrating it, usually you are building a graphical UI (an 'app' or web interface) to view and change the environment.

### Prerequisites

Install the library via npm
* npm
  ```sh
  npm install fieldfare
  ```

### CLI Tools

The CLI tools can be used to setup a service written in javascript as a standalone server. They can also be used to configure the environment, adding or removing admins, services, authorizations and webports.

#### ffsetup

This tools is used to edit only the Local Host information, all changes performed here are stored locally in the folder you are currently working. All the options that this tool offers can be acessed from the menu by calling:

```sh
ffsetup
```

The first this to do when setting up a service is to generate the host private key. This option is accessible via 'Local Host > Generate Private Key'. This will overwrite any previosu key information, discarding it forever, so beware.

After the key is generated, the host will receive ad ID, you can copy it since this will be the identification of the host you are setting up and can be used if you are integrating to an already existing environment and will need to add an authorization.

To define the UUID of the environment, use "Environment > Set UUID". By doing this you will scrap any previous UUID defined, so if you didn't have a copy of it, beware.

The last step is to add a "Boot Webport" and is not always needed. This information is used to perform a bootstrap of the host when it is freshly configured and needs to find another enviroment participants to exchange information. If this service will be a central node, probably the other hosts will find it via its public IP that can be configured later.

#### ffconf

This tool is used to edit the Environment data directly. All changes performed via ffconf are propagated to all environment participants and permanently stored everywhere. Since the configuration is sotored locally, please perform this step in teh sam eworking folder where you previously called ffsetup.

To access the tool menu, you must call:

```sh
ffconf menu
```

TODO: Configuration steps;

#### ffrun <path_to_service>

This step will import a JS module that implements the service methods according to its definition. All information from ffsetup will be used to setup the host and connect to the enviroment.

<p align="right">(<a href="#top">back to top</a>)</p>

### Setup

In your code, import ffinit according to the platform you are using:

If you are using Node.js, you can import like this:
```js
import {ffinit} from 'fieldfare/node';
```
This will also implement a WebSocket Server and a UDP Transceiver, please check the section about Webports to learn how to define the ports where the server will listen. The node setup will use LevelDB to sotre all non-volatile objects and resources used by the environment you are connecting to.

Or, if you are building for the browser, please do the following:

```js
import {ffinit} from 'fieldfare/browser';
```
This will implement a WebSocket client Transceiver only, that cannot receive incomming connections. The browser setup will use IndexedDB to store all non-volatile objects and resources.

Define a UUID in string format to uniquely identify your data environment, that must be the same for all participants:
```js
const envUUID = '3481b164-58ac-4c68-8d9a-7e3c85839ca5';
```
Warning: please don't use this UUID, it was randomly generated for this example only. You can generate a random UUID in any online service (https://www.uuidgenerator.net/version4) or use a library like:

```sh
npm i uuid
```

Now you can initilize the LocalHost and Environment like this:

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

Distributed under the ISC License. See `LICENSE.txt` for more information.

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
[product-screenshot]: doc/images/cli-example.png
