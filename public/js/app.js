angular.module('flashMessageService', [])
    .service('flashMessage', function() {
        this.add = function(data) {

            $('<p style="display:none;" class="flash-message ' + data.type + '">' + data.contents + '</p>').appendTo('#flash-message-container').slideDown(300);

            setTimeout(function() {
                $('.flash-message').slideUp(300, function() {
                   $(this).remove();
                });
            }, 3000);
        };
    });

angular.module("missionsApp", ["directives.missionCard"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("missionsController", ['$scope', function($scope) {
    $scope.missions = laravel.missions;
}]);
angular.module("missionControlApp", ["directives.tags"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("missionControlController", ["$scope", function($scope) {
    $scope.tags = [];
    $scope.selectedTags = [];
}]);
angular.module("futureMissionApp", ["directives.countdown", "flashMessageService"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("futureMissionController", ['$http', '$scope', 'flashMessage', function($http, $scope, flashMessage) {

    $scope.missionSlug = laravel.slug;
    $scope.launchDateTime = laravel.launchDateTime;
    $scope.launchSpecificity = laravel.launchSpecificity;

    $scope.$watch("launchSpecificity", function(newValue) {
        $scope.isLaunchExact =  (newValue == 6 || newValue == 7);
    });

    $scope.$watchCollection('[isLaunchExact, launchDateTime]', function(newValues) {
        if (newValues[0] === true) {
            $scope.launchUnixSeconds =  (moment(newValues[1]).unix());
        }
        $scope.launchUnixSeconds =  null;
    });

    $scope.lastRequest = moment().unix();
    $scope.secondsSinceLastRequest = 0;

    $scope.secondsToLaunch;

    $scope.requestFrequencyManager = function() {
        $scope.secondsSinceLastRequest = Math.floor($.now() / 1000) - $scope.lastRequest;
        $scope.secondsToLaunch = $scope.launchUnixSeconds - Math.floor($.now() / 1000);

        /*
         Make requests to the server for launchdatetime and webcast updates at the following frequencies:
         >24hrs to launch    =   1hr / request
         1hr-24hrs           =   15min / request
         20min-1hr           =   5 min / request
         <20min              =   30sec / request
         */
        var aRequestNeedsToBeMade = ($scope.secondsToLaunch >= 86400 && $scope.secondsSinceLastRequest >= 3600) ||
            ($scope.secondsToLaunch >= 3600 && $scope.secondsToLaunch < 86400 && $scope.secondsSinceLastRequest >= 900) ||
            ($scope.secondsToLaunch >= 1200 && $scope.secondsToLaunch < 3600 && $scope.secondsSinceLastRequest >= 300) ||
            ($scope.secondsToLaunch < 1200 && $scope.secondsSinceLastRequest >= 30);

        if (aRequestNeedsToBeMade === true) {
            // Make both requests then update the time since last request
            $scope.requestLaunchDateTime();
            $scope.requestWebcastStatus();
            $scope.lastRequest = moment().unix();
        }
    }

    $scope.requestLaunchDateTime = function() {
        $http.get('/missions/' + $scope.missionSlug + '/requestlaunchdatetime')
            .then(function(response) {
                // If there has been a change in the launch datetime, update
                if ($scope.launchDateTime !== response.data.launchDateTime) {
                    $scope.launchDateTime = response.data.launchDateTime;
                    $scope.launchSpecificity = response.data.launchSpecificity;

                    flashMessage.add({ type: 'success', contents: 'Launch time updated!' });
                }
            });
    }

    $scope.requestWebcastStatus = function() {
        $http.get('/webcast/getstatus')
            .then(function(response) {
                $scope.webcast.isLive = response.data.isLive;
                $scope.webcast.viewers = response.data.viewers;
            });
    }

    $scope.webcast = {
        isLive: laravel.webcast.isLive,
        viewers: laravel.webcast.viewers
    }

    $scope.$watchCollection('[webcast.isLive, secondsToLaunch]', function(newValues) {
        if (newValues[1] < (60 * 60 * 24) && newValues[0] == 'true') {
            $scope.webcast.status = 'webcast-live';
        } else if (newValues[1] < (60 * 60 * 24) && newValues[0] == 'false') {
            $scope.webcast.status = 'webcast-updates';
        } else {
            $scope.webcast.status = 'webcast-inactive';
        }
    });

    $scope.$watch('webcast.status', function(newValue) {
        if (newValue === 'webcast-live') {
            $scope.webcast.publicStatus = 'Live Webcast'
        } else if (newValue === 'webcast-updates') {
            $scope.webcast.publicStatus = 'Launch Updates'
        }
    }),

    $scope.$watch('webcast.viewers', function(newValue) {
        $scope.webcast.publicViewers = ' (' + newValue + ' viewers)';
    })

}]);

angular.module("uploadApp", ["directives.upload", "directives.selectList", "directives.tags", "directives.deltaV"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("uploadAppController", ["$scope", function($scope) {
    $scope.activeSection = "upload";

    $scope.missions = laravel.missions;
    $scope.tags = laravel.tags;

    $scope.changeSection = function(section) {
        $scope.activeSection = section;
    }

}]).controller("uploadController", ["$rootScope", "$scope", "objectFromFile", function($rootScope, $scope, objectFromFile) {
    $scope.activeUploadSection = "dropzone";
    $scope.buttonText = "Next";

    $scope.currentVisibleFile = null;
    $scope.isVisibleFile = function(file) {
        return $scope.currentVisibleFile === file;
    };
    $scope.setVisibleFile = function(file) {
        $scope.currentVisibleFile = file;
    };

    $scope.uploadCallback = function() {

        // Once files have been successfully upload, convert to Objects
        $scope.files.forEach(function(file, index) {
            file = objectFromFile.create(file, index);

            // Set the initial visible file
            if (index === 0) {
                $scope.currentVisibleFile = file;
            }
        });

        // Change the upload section
        $scope.activeUploadSection = "data";
        $scope.$apply();
    };

    $scope.fileSubmitButtonFunction = function() {
        console.log($scope.files);
        $rootScope.postToMissionControl($scope.files, 'files');
    }

}]).controller("postController", ["$scope", function($scope) {

}]).controller("writeController", ["$scope", function($scope) {

}]).run(['$rootScope', '$http', function($rootScope, $http) {
    $rootScope.postToMissionControl = function(dataToUpload, submissionHeader) {
        var req = {
            method: 'POST',
            url: '/missioncontrol/create/submit',
            headers: {
                'Submission-Type': submissionHeader
            },
            data: {
                data: dataToUpload
            }
        };

        $http(req).then(function() {
            window.location = '/missioncontrol';
        });
    }
}]).factory("Image", function() {
    return function (image, index) {
        var self = image;

        self.index = index;

        self.title = null;
        self.summary = null;
        self.subtype = null;
        self.mission_id = null;
        self.author = null;
        self.attribution = null;
        self.anonymous = null;
        self.tags = [];
        self.originated_at = null;

        return self;
    }

}).factory("GIF", function() {
    return function(gif, index) {
        var self = gif;

        self.index = index;

        self.title = null;
        self.summary = null;
        self.subtype = null;
        self.mission_id = null;
        self.author = null;
        self.attribution = null;
        self.anonymous = null;
        self.tags = [];
        self.originated_at = null;

        return self;
    }

}).factory("Audio", function() {
    return function(audio, index) {
        var self = audio;

        self.index = index;

        self.title = null;
        self.summary = null;
        self.subtype = null;
        self.mission_id = null;
        self.author = null;
        self.attribution = null;
        self.anonymous = null;
        self.tags = [];
        self.originated_at = null;

        return self;
    }

}).factory("Video", function() {
    return function(video, index) {
        var self = video;

        self.index = index;

        self.title = null;
        self.summary = null;
        self.subtype = null;
        self.mission_id = null;
        self.author = null;
        self.attribution = null;
        self.anonymous = null;
        self.tags = [];
        self.originated_at = null;

        return self;
    }

}).factory("Document", function() {
    return function(document, index) {
        var self = document;

        self.index = index;

        self.title = null;
        self.summary = null;
        self.subtype = null;
        self.mission_id = null;
        self.author = null;
        self.attribution = null;
        self.anonymous = null;
        self.tags = [];
        self.originated_at = null;

        return self;
    }
}).service("objectFromFile", ["Image", "GIF", "Audio", "Video", "Document", function(Image, GIF, Audio, Video, Document) {
    this.create = function(file, index) {
        switch(file.type) {
            case 1: return new Image(file, index);
            case 2: return new GIF(file, index);
            case 3: return new Audio(file, index);
            case 4: return new Video(file, index);
            case 5: return new Document(file, index);
            default: return null;
        }
    }
}]);

angular.module('questionsApp', [], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("questionsController", ["$scope", function($scope) {
    $scope
}]);

angular.module("homePageApp", ["directives.countdown"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("homePageController", ['$scope', 'Statistic', function($scope, Statistic) {
    $scope.statistics = [];

    $scope.activeStatistic = false;

    laravel.statistics.forEach(function(statistic) {
        $scope.statistics.push(new Statistic(statistic));
    });

    $scope.goToClickedStatistic = function(statisticType) {
        $scope.activeStatistic = statisticType;
    }

    $scope.goToPreviousStatistic = function() {

    }

    $scope.goToNextStatistic = function() {

    }

    $scope.$watch("activeStatistic", function(newValue, oldValue) {

    });
}])

.factory('Statistic', ['Substatistic', function(Substatistic) {
    return function(statistic) {

        var self = {};

        statistic.forEach(function(substatistic) {

            var substatisticObject = new Substatistic(substatistic);

            if (!self.substatistics) {

                self.substatistics = [];
                self.activeSubstatistic = substatisticObject;
                self.type = substatisticObject.type;
            }

            self.substatistics.push(substatisticObject);
        });

        self.changeSubstatistic = function(newSubstatistic) {
            self.activeSubstatistic = newSubstatistic;
        };

        return self;
    }
}])

.factory('Substatistic', function() {
    return function(substatistic) {

        var self = substatistic;

        return self;
    }
});

angular.module('reviewApp', [], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("reviewController", ["$scope", "$http", "ObjectToReview", function($scope, $http, ObjectToReview) {

    $scope.visibilities = ['Default', 'Public', 'Hidden'];

    $scope.objectsToReview = [];

    $scope.action = function(object, newStatus) {

        object.status = newStatus;

        $http.post('/missioncontrol/review/update/' + object.object_id, {
                visibility: object.visibility, status: object.status
        }).then(function() {
            $scope.objectsToReview.splice($scope.objectsToReview.indexOf(object), 1);

        }, function(response) {
            alert('An error occured');
        });
    };

    (function() {
        $http.get('/missioncontrol/review/get').then(function(response) {
            response.data.forEach(function(objectToReview) {
                 $scope.objectsToReview.push(new ObjectToReview(objectToReview));
            });
            console.log($scope.objectsToReview);
        });
    })();

}]).factory("ObjectToReview", function() {
    return function (object) {
        var self = object;

        self.visibility = "Default";

        self.linkToObject = '/missioncontrol/object/' + self.object_id;

        self.linkToUser = 'users/' + self.user.username;

        self.textType = function() {
            switch(self.type) {
                case 1:
                    return 'Image';
                case 2:
                    return 'GIF';
                case 3:
                    return 'Audio';
                case 4:
                    return 'Video';
                case 5:
                    return 'Document';
            }
        };

        self.textSubtype = function() {
            switch(self.subtype) {
                case 1:
                    return 'MissionPatch';
                case 2:
                    return 'Photo';
                case 3:
                    return 'Telemetry';
                case 4:
                    return 'Chart';
                case 5:
                    return 'Screenshot';
                case 6:
                    return 'LaunchVideo';
                case 7:
                    return 'PressConference';
                case 8:
                    return 'PressKit';
                case 9:
                    return 'CargoManifest';
                default:
                    return null;
            }
        };

        self.createdAtRelative = moment.utc(self.created_at).fromNow();

        return self;
    }

});


angular.module('objectApp', [], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("objectController", ["$scope", "$http", function($scope, $http) {

    $scope.note = laravel.userNote !== null ? laravel.userNote.note : "";
    $scope.object = laravel.object;

    $scope.$watch("note", function(noteValue) {
        if (noteValue === "" || noteValue === null) {
            $scope.noteButtonText = "Create Note";
            $scope.noteReadText = "Create a Note!";
        } else {
            $scope.noteButtonText = "Edit Note";
            $scope.noteReadText = noteValue;
        }
    });

    $scope.noteState = "read";
    $scope.changeNoteState = function() {

        $scope.originalNote = $scope.note;

        if ($scope.noteState == "read") {
            $scope.noteState = "write";
        } else {
            $scope.noteState = "read";
        }
    };

    $scope.saveNote = function() {
        if ($scope.originalNote === "") {

            $http.post('/missioncontrol/objects/' + $scope.object.object_id + '/note', {
                note: $scope.note
            }).then(function() {
                $scope.changeNoteState();
            });

        } else {

            $http.patch('/missioncontrol/objects/' + $scope.object.object_id + '/note', {
                note: $scope.note
            }).then(function() {
                $scope.changeNoteState();
            });
        }
    };

    $scope.deleteNote = function() {
        $http.delete('/missioncontrol/objects/' + $scope.object.object_id + '/note')
            .then(function() {
                $scope.note = "";
                $scope.changeNoteState();
            });
    };

    /* FAVORITES */
    $scope.favorites = laravel.totalFavorites;

    $scope.$watch("favorites", function(newFavoritesValue) {
        if (newFavoritesValue == 1) {
            $scope.favoritesText = "1 Favorite";
        }  else {
            $scope.favoritesText = $scope.favorites + " Favorites";
        }
    });

    $scope.isFavorited = laravel.isFavorited !== null;
    $scope.toggleFavorite = function() {

        $scope.isFavorited = !$scope.isFavorited;

        if ($scope.isFavorited === true) {

            var requestType = 'POST';
            $scope.favorites++;
            $http.post('/missioncontrol/objects/' + $scope.object.object_id + '/favorite');

        } else if ($scope.isFavorited === false) {

            var requestType = 'DELETE';
            $scope.favorites--;
            $http.delete('/missioncontrol/objects/' + $scope.object.object_id + '/favorite');

        }
    };

    /* DOWNLOAD */
    $scope.incrementDownloads = function() {
        $http.get('/missioncontrol/objects/' + $scope.object.object_id + '/download');
    }
}]);


angular.module("editUserApp", ["directives.selectList", "flashMessageService"], ['$interpolateProvider', function($interpolateProvider) {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

}]).controller("editUserController", ['$http', '$scope', 'flashMessage', function($http, $scope, flashMessage) {

    $scope.username = laravel.user.username;

    $scope.missions = laravel.missions;

    $scope.profile = {
        summary: laravel.user.profile.summary,
        twitter_account: laravel.user.profile.twitter_account,
        reddit_account: laravel.user.profile.reddit_account,
        favorite_quote: laravel.user.profile.favorite_quote,
        favorite_mission: laravel.user.profile.favorite_mission,
        favorite_patch: laravel.user.profile.favorite_patch
    };

    $scope.updateProfile = function() {
        $http.post('/users/' + $scope.username + '/edit/profile', $scope.profile)
            .then(function(response) {
                flashMessage.add(response.data);
            });
    }

    $scope.emailNotifications = {
        launchTimeChange: laravel.notifications.launchTimeChange,
        newMission: laravel.notifications.newMission,
        tMinus24HoursEmail: laravel.notifications.tMinus24HoursEmail,
        tMinus3HoursEmail: laravel.notifications.tMinus3HoursEmail,
        tMinus1HourEmail: laravel.notifications.tMinus1HourEmail,
        newsSummaries: laravel.notifications.newsSummaries
    }

    $scope.updateEmailNotifications = function() {
        console.log(laravel);
        console.log($scope.emailNotifications);

        $http.post('/users/' + $scope.username + '/edit/emailnotifications',
            { 'emailNotifications': $scope.emailNotifications }
        )
            .then(function(response) {
                console.log(response);
            });
    }

    $scope.SMSNotification = {
        mobile: laravel.user.mobile
    }

    if (laravel.notifications.tMinus24HoursSMS === true) {
        $scope.SMSNotification.status = "tMinus24HoursSMS";
    } else if (laravel.notifications.tMinus3HoursSMS === true) {
        $scope.SMSNotification.status = "tMinus3HoursSMS";
    } else if (laravel.notifications.tMinus1HourSMS === true) {
        $scope.SMSNotification.status = "tMinus1HourSMS";
    } else {
        $scope.SMSNotification.status = null;
    }

    $scope.updateSMSNotifications = function() {
        $http.post('/users/' + $scope.username + '/edit/smsnotifications',
            { 'SMSNotification': $scope.SMSNotification }
        )
            .then(function(response) {
                flashMessage.add(response.data);
            });
    }

}]);

angular.module("directives.selectList", []).directive("selectList", function() {
    return {
        restrict: 'E',
        scope: {
            options: '=',
            hasDefaultOption: '@',
            selectedOption: '=',
            uniqueKey: '@',
            searchable: '@'
        },
        link: function($scope, element, attributes) {

            $scope.optionsObj = $scope.options.map(function(option) {
                return {
                    id: option[$scope.uniqueKey],
                    name: option.name,
                    image: option.featuredImage ? option.featuredImage.media_thumb_small : null
                };
            });

            $scope.$watch("selectedOption", function(newValue) {
                $scope.selectedOptionObj = $scope.optionsObj
                    .filter(function(option) {
                    return option['id'] == newValue;
                }).shift();
            });

            $scope.selectOption = function(option) {
                $scope.selectedOption = option['id'];
                $scope.dropdownIsVisible = false;
            }

            $scope.toggleDropdown = function() {
                $scope.dropdownIsVisible = !$scope.dropdownIsVisible;
            }

            $scope.$watch("dropdownIsVisible", function(newValue) {
                if (!newValue) {
                    $scope.search = "";
                }
            });

            $scope.isSelected = function(option) {
                return option.id == $scope.selectedOption;
            }

            $scope.dropdownIsVisible = false;
        },
        templateUrl: '/js/templates/selectList.html'
    }
});


// Original jQuery countdown timer written by /u/EchoLogic, improved and optimized by /u/booOfBorg.
// Rewritten as an Angular directive for SpaceXStats 4
angular.module('directives.countdown', []).directive('countdown', ['$interval', function($interval) {
    return {
        restrict: 'E',
        scope: {
            specificity: '=',
            countdownTo: '=',
            callback: '&'
        },
        link: function($scope) {

            $scope.isLaunchExact = ($scope.specificity == 6 || $scope.specificity == 7);

            $scope.$watch('specificity', function(newValue) {
                $scope.isLaunchExact = (newValue == 6 || newValue == 7);
            });

            (function() {
                if ($scope.isLaunchExact) {

                    $scope.launchUnixSeconds = moment($scope.countdownTo).unix();


                    $scope.countdownProcessor = function() {

                        var launchUnixSeconds = $scope.launchUnixSeconds;
                        var currentUnixSeconds = Math.floor($.now() / 1000);

                        if (launchUnixSeconds >= currentUnixSeconds) {
                            $scope.secondsAwayFromLaunch = launchUnixSeconds - currentUnixSeconds;

                            var secondsBetween = $scope.secondsAwayFromLaunch;
                            // Calculate the number of days, hours, minutes, seconds
                            $scope.days = Math.floor(secondsBetween / (60 * 60 * 24));
                            secondsBetween -= $scope.days * 60 * 60 * 24;

                            $scope.hours = Math.floor(secondsBetween / (60 * 60));
                            secondsBetween -= $scope.hours * 60 * 60;

                            $scope.minutes = Math.floor(secondsBetween / 60);
                            secondsBetween -= $scope.minutes * 60;

                            $scope.seconds = secondsBetween;

                            $scope.daysText = $scope.days == 1 ? 'Day' : 'Days';
                            $scope.hoursText = $scope.hours == 1 ? 'Hour' : 'Hours';
                            $scope.minutesText = $scope.minutes == 1 ? 'Minute' : 'Minutes';
                            $scope.secondsText = $scope.seconds == 1 ? 'Second' : 'Seconds';

                            // Stop the countdown, count up!
                        } else {
                        }

                        if ($scope.callback && typeof $scope.callback === 'function') {
                            $scope.callback();
                        }
                    };

                    $interval($scope.countdownProcessor, 1000);
                } else {
                    $scope.countdownText = $scope.countdownTo;
                }
            })();

        },
        templateUrl: '/js/templates/countdown.html'
    }
}]);

angular.module('directives.upload', []).directive('upload', ['$parse', function($parse) {
    return {
        restrict: 'A',
        link: function($scope, element, attrs) {

            // Initialize the dropzone
            var dropzone = new Dropzone(element[0], {
                url: attrs.action,
                autoProcessQueue: false,
                dictDefaultMessage: "Upload files here!",
                maxFilesize: 1024, // MB
                addRemoveLinks: true,
                uploadMultiple: attrs.multiUpload,
                parallelUploads: 5,
                maxFiles: 5,
                successmultiple: function(dropzoneStatus, files) {

                    $scope.files = files.objects;

                    // Run a callback function with the files passed through as a parameter
                    if (typeof attrs.callback !== 'undefined' && attrs.callback !== "") {
                        var func = $parse(attrs.callback);
                        func($scope, { files: files });
                    }
                }
            });

            // upload the files
            $scope.uploadFiles = function() {
                dropzone.processQueue();
            }
        }
    }
}]);
angular.module('directives.missionCard', []).directive('missionCard', function() {
    return {
        restrict: 'E',
        scope: {
            size: '@',
            mission: '='
        },
        link: function($scope) {
            console.log(mission);
        },
        templateUrl: '/js/templates/missionCard.html'
    }
});

angular.module("directives.tags", []).directive("tags", ["Tag", "$timeout", function(Tag, $timeout) {
    return {
        restrict: 'E',
        scope: {
            availableTags: '=',
            selectedTags: '='
        },
        link: function($scope, element, attributes) {

            $scope.suggestions = [];
            $scope.inputWidth = {};

            $scope.createTag = function(createdTag) {
                var tagIsPresentInCurrentTags = $scope.selectedTags.filter(function(tag) {
                    return tag.name == createdTag;
                });

                if (createdTag.length > 0 && tagIsPresentInCurrentTags.length === 0) {

                    // check if tag is present in the available tags array
                    var tagIsPresentInAvailableTags = $scope.availableTags.filter(function(tag) {
                        return tag.name == createdTag;
                    });

                    if (tagIsPresentInAvailableTags.length === 1) {
                        // grab tag
                        var newTag = tagIsPresentInAvailableTags[0];
                    } else {
                        // trim and convert the text to lowercase, then create!
                        var newTag = new Tag({ id: null, name: $.trim(createdTag.toLowerCase()), description: null });
                    }

                    $scope.selectedTags.push(newTag);

                    // reset the input field
                    $scope.tagInput = "";

                    $scope.updateSuggestionList();
                    $scope.updateInputLength();
                }
            };

            $scope.removeTag = function(removedTag) {
                $scope.selectedTags.splice($scope.selectedTags.indexOf(removedTag), 1);
                $scope.updateSuggestionList();
                $scope.updateInputLength();
            };

            $scope.tagInputKeyPress = function(event) {
                // Currently using jQuery.event.which to detect keypresses, keyCode is deprecated, use KeyboardEvent.key eventually:
                // https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key

                // event.key == ' ' || event.key == 'Enter'
                if (event.which == 32 || event.which == 13) {
                    event.preventDefault();

                    // Remove any rulebreaking chars
                    var tag = $scope.tagInput;
                    tag = tag.replace(/["']/g, "");
                    // Remove whitespace if present
                    tag = tag.trim();

                    $scope.createTag(tag);

                // event.key == 'Backspace'
                } else if (event.which == 8 && $scope.tagInput == "") {
                    event.preventDefault();

                    // grab the last tag to be inserted (if any) and put it back in the input
                    if ($scope.selectedTags.length > 0) {
                        $scope.tagInput = $scope.selectedTags.pop().name;
                    }
                }
            };

            $scope.updateInputLength = function() {
                $timeout(function() {
                    $scope.inputLength = $(element).find('.wrapper').innerWidth() - $(element).find('.tag-wrapper').outerWidth() - 1;
                });
            };

            $scope.areSuggestionsVisible = false;
            $scope.toggleSuggestionVisibility = function() {
                $scope.areSuggestionsVisible = !$scope.areSuggestionsVisible;
            };

            $scope.updateSuggestionList = function() {
                var search = new RegExp($scope.tagInput, "i");

                $scope.suggestions = $scope.availableTags.filter(function(availableTag) {
                    if ($scope.selectedTags.filter(function(currentTag) {
                            return availableTag.name == currentTag.name;
                        }).length == 0) {
                        return search.test(availableTag.name);
                    }
                    return false;
                }).slice(0,6);
            };
        },
        templateUrl: '/js/templates/tags.html'
    }
}]).factory("Tag", function() {
    return function(tag) {
        var self = tag;
        return self;
    }
});


angular.module('directives.deltaV', []).directive('deltaV', function() {
    return {
        restrict: 'A',
        scope: {
            deltaV: '='
        },
        link: function($scope, element, attributes) {

            $scope.$watch("deltaV", function(files) {
                if (typeof files !== 'undefined') {
                    files.forEach(function(file) {
                        console.log(Object.prototype.toString.call(file));
                    });
                }
            });

            $scope.calculatedValue = 0;
        },
        template: '<span>[[ calculatedValue ]] m/s of dV</span>'
    }
});

