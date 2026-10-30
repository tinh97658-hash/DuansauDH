from audit_camera_metadata import camera_token, manifest_stats, original_name, token_relation


def test_camera_parser_does_not_invent_camera_or_session_from_image_index():
    assert original_name(r"images\gallery\gallery__7_cam10_3.jpg") == "7_cam10_3.jpg"
    assert camera_token(r"images\gallery\gallery__7_cam10_3.jpg") == "cam10"
    assert camera_token("mated__7_10.jpg") == ""
    assert token_relation("", "cam1") == "missing_token"
    assert token_relation("cam1", "cam1") == "same_token"
    assert token_relation("cam1", "cam2") == "different_tokens"


def test_manifest_stats_preserve_missingness_and_expose_parser_mismatch():
    rows = [dict(person_id="7", image_path="gallery__7_cam1_1.jpg", camera_id="cam1", session_id="", role="gallery"),
            dict(person_id="7", image_path="mated__7_cam2_1.jpg", camera_id="cam2", session_id="", role="mated"),
            dict(person_id="8", image_path="gallery__8_1.jpg", camera_id="", session_id="", role="gallery")]
    stats = manifest_stats(rows)
    assert stats["missing_camera"] == 1 and stats["missing_session"] == 3
    assert stats["identities_with_at_least_two_known_tokens"] == 1
    assert stats["identities_with_no_known_token"] == 1
    rows[0]["camera_id"] = "cam9"
    assert manifest_stats(rows)["camera_parser_mismatches"] == 1
