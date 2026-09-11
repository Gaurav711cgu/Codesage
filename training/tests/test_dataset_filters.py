import pytest
from training.dataset_prep import (
    filter_language,
    filter_message_quality,
    filter_file_size,
    filter_actual_change,
    filter_bugfix_signal,
    filter_syntax_valid,
)

def test_filter_language():
    assert filter_language({"lang": "python"}) is True
    assert filter_language({"lang": "PYTHON"}) is True
    assert filter_language({"lang": "java"}) is False
    assert filter_language({}) is False

def test_filter_message_quality():
    assert filter_message_quality({"message": "this is a very long commit message with eight words"}) is True
    assert filter_message_quality({"message": "too short"}) is False

def test_filter_actual_change():
    assert filter_actual_change({"old_contents": "a = 1", "new_contents": "a = 2"}) is True
    assert filter_actual_change({"old_contents": "a = 1", "new_contents": "a = 1"}) is False

def test_filter_bugfix_signal():
    assert filter_bugfix_signal({"message": "fix: null pointer exception"}) is True
    assert filter_bugfix_signal({"message": "Added new feature for user profile"}) is False

def test_filter_syntax_valid():
    assert filter_syntax_valid({"old_contents": "a = 1\nb = 2", "new_contents": "a = 2"}) is True
    assert filter_syntax_valid({"old_contents": "def foo(:\n  pass", "new_contents": "def foo():\n  pass"}) is False
