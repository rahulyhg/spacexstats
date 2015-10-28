<?php
namespace SpaceXStats\Http\Controllers\MissionControl;

use Illuminate\Support\Facades\Input;
use SpaceXStats\Facades\Search;
use SpaceXStats\Http\Controllers\Controller;
use SpaceXStats\Library\Enums\MissionControlSubtype;
use SpaceXStats\Library\Enums\MissionControlType;

class SearchController extends Controller {
    // POST
    public function search() {
        $results = Search::search(Input::get('search'));
        return response()->json($results);
    }

    public function fetch() {
        return response()->json([
            'missions' => Mission::all(),
            'types' => array_merge(MissionControlType::toArray(), MissionControlSubtype::toArray()),

        ]);
    }
}